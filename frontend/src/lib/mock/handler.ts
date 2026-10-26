import type {
  AuthSession,
  ExamInput,
  ExportPayload,
  ExportRow,
  GradeItem,
  QuestionInput,
  UserInput,
} from '@/types/api';
import type {
  AnswerValue,
  AttemptPayload,
  DashboardStats,
  Exam,
  ExamStats,
  LogEntry,
  Paginated,
  Question,
  ResultDetail,
  ResultRow,
  Role,
  SaveAttemptResult,
  SchoolSettings,
  Submission,
  User,
} from '@/types/domain';
import { env } from '@/lib/env';
import { normalizeText, round2, uid, formatDuration } from '@/lib/utils';
import { getDb, saveDb, type MockDB, type MockSubmission, type MockUserRecord } from './db';

type Payload = Record<string, unknown>;

export class MockError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'MockError';
    this.code = code;
    this.details = details;
  }
}

let failNextRequest = false;

/** Dev toolbar hook: force a 500 on the next request to exercise the error UI. */
export function simulateNextError(): void {
  failNextRequest = true;
}

const ACCESS_TTL = 2 * 60 * 60 * 1000;
const REFRESH_TTL = 7 * 24 * 60 * 60 * 1000;
const GRACE_MS = 10_000;

function as<T>(value: unknown): T {
  return value as T;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function nowIso(): string {
  return new Date().toISOString();
}

/* ------------------------------------------------------------------ tokens */

interface TokenPayload {
  sub: string;
  typ: 'access' | 'refresh';
  exp: number;
  tv: number;
}

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function makeToken(user: MockUserRecord, typ: TokenPayload['typ'], ttl: number): string {
  const payload: TokenPayload = {
    sub: user.id,
    typ,
    exp: Date.now() + ttl,
    tv: user.tokenVersion,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  // Signature is intentionally fake: this backend lives in the browser only.
  return `${encoded}.${base64UrlEncode(`mock:${typ}`)}`;
}

function decodeToken(token: string): TokenPayload {
  try {
    const [encoded] = token.split('.');
    if (!encoded) throw new Error('Malformed token');
    const parsed = JSON.parse(base64UrlDecode(encoded)) as Partial<TokenPayload>;
    if (!parsed.sub || !parsed.typ || typeof parsed.exp !== 'number') {
      throw new Error('Malformed payload');
    }
    return { sub: parsed.sub, typ: parsed.typ, exp: parsed.exp, tv: parsed.tv ?? 0 };
  } catch {
    throw new MockError('UNAUTHORIZED', 'Token tidak valid. Silakan masuk kembali.');
  }
}

/* ----------------------------------------------------------------- helpers */

function publicUser(user: MockUserRecord): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    nis: user.nis,
    kelas: user.kelas,
    avatarUrl: user.avatarUrl,
    active: user.active,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function sessionFor(user: MockUserRecord): AuthSession {
  return {
    accessToken: makeToken(user, 'access', ACCESS_TTL),
    refreshToken: makeToken(user, 'refresh', REFRESH_TTL),
    user: publicUser(user),
  };
}

function authenticate(db: MockDB, payload: Payload, roles?: Role[]): MockUserRecord {
  const token = str(payload.token);
  if (!token) throw new MockError('UNAUTHORIZED', 'Anda harus masuk terlebih dahulu.');
  const decoded = decodeToken(token);
  if (decoded.typ !== 'access') throw new MockError('UNAUTHORIZED', 'Jenis token tidak sesuai.');
  if (decoded.exp < Date.now()) {
    throw new MockError('TOKEN_EXPIRED', 'Sesi berakhir, menyegarkan token...');
  }
  const user = db.users.find((item) => item.id === decoded.sub);
  if (!user || !user.active || user.tokenVersion !== decoded.tv) {
    throw new MockError('UNAUTHORIZED', 'Akun tidak ditemukan atau sesi sudah dicabut.');
  }
  if (roles && !roles.includes(user.role)) {
    throw new MockError('FORBIDDEN', 'Anda tidak memiliki akses untuk tindakan ini.');
  }
  return user;
}

function paginate<T>(items: T[], page = 1, pageSize = 20): Paginated<T> {
  const size = Math.min(100, Math.max(1, Math.round(pageSize) || 20));
  const current = Math.max(1, Math.round(page) || 1);
  const start = (current - 1) * size;
  return {
    items: items.slice(start, start + size),
    total: items.length,
    page: current,
    pageSize: size,
    hasMore: start + size < items.length,
  };
}

function log(
  db: MockDB,
  actor: MockUserRecord | null,
  action: string,
  entity?: string,
  entityId?: string,
  meta?: Record<string, unknown>,
): void {
  const entry: LogEntry = {
    id: uid('LOG'),
    ts: nowIso(),
    actorId: actor?.id,
    actorName: actor?.name,
    action,
    entity,
    entityId,
    meta,
  };
  db.logs.unshift(entry);
  if (db.logs.length > 2000) db.logs.length = 2000;
}

function publicSubmission(db: MockDB, sub: MockSubmission): Submission {
  const user = db.users.find((item) => item.id === sub.studentId);
  const exam = db.exams.find((item) => item.id === sub.examId);
  return {
    id: sub.id,
    examId: sub.examId,
    examName: exam?.nama ?? sub.examName ?? 'Ujian',
    studentId: sub.studentId,
    studentName: user?.name ?? sub.studentName ?? 'Siswa',
    studentNis: user?.nis ?? sub.studentNis ?? '',
    kelas: user?.kelas ?? sub.kelas ?? '',
    mulaiAt: sub.mulaiAt,
    expiresAt: sub.expiresAt,
    submitAt: sub.submitAt,
    status: sub.status,
    skor: sub.skor,
    skorMaks: sub.skorMaks,
    benar: sub.benar,
    salah: sub.salah,
    kosong: sub.kosong,
    perluManual: sub.perluManual,
    tabSwitchCount: sub.tabSwitchCount,
    autoSubmitted: sub.autoSubmitted,
    lastSeenAt: sub.lastSeenAt,
    durationSec: sub.durationSec,
  };
}

function hasValue(value: AnswerValue | null | undefined): boolean {
  if (!value) return false;
  if (Array.isArray(value.selected)) return value.selected.length > 0;
  if (typeof value.value === 'boolean') return true;
  if (typeof value.text === 'string') return value.text.trim().length > 0;
  return false;
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort().join('|');
  const right = [...b].sort().join('|');
  return left === right;
}

function isCorrect(question: Question, value: AnswerValue): boolean {
  const key = question.kunci;
  if (!key) return false;
  switch (question.tipe) {
    case 'pg':
      return Array.isArray(value.selected) && value.selected.length === 1 &&
        sameSet(value.selected, key.selected ?? []);
    case 'pg_kompleks':
      return Array.isArray(value.selected) && sameSet(value.selected, key.selected ?? []);
    case 'benar_salah':
      return typeof value.value === 'boolean' && value.value === key.value;
    case 'isian': {
      const answer = normalizeText(value.text ?? '');
      if (!answer) return false;
      return (key.accepted ?? []).some((item) => normalizeText(item) === answer);
    }
    case 'essay':
    default:
      return false;
  }
}

function examQuestionsFor(db: MockDB, examId: string): { question: Question; bobot: number }[] {
  return db.examQuestions
    .filter((item) => item.examId === examId)
    .sort((a, b) => a.urutan - b.urutan)
    .map((item) => {
      const question = db.questions.find((q) => q.id === item.questionId);
      return question ? { question, bobot: item.bobot || question.bobot } : null;
    })
    .filter((item): item is { question: Question; bobot: number } => item !== null);
}

function bobotFor(db: MockDB, examId: string, questionId: string, fallback: number): number {
  const link = db.examQuestions.find(
    (item) => item.examId === examId && item.questionId === questionId,
  );
  return link?.bobot && link.bobot > 0 ? link.bobot : fallback;
}

function totalBobotFor(db: MockDB, sub: MockSubmission): number {
  return sub.questionOrder.reduce((total, questionId) => {
    const question = db.questions.find((q) => q.id === questionId);
    return total + (question ? bobotFor(db, sub.examId, questionId, question.bobot) : 0);
  }, 0);
}

function recomputeSubmission(db: MockDB, sub: MockSubmission): void {
  const total = totalBobotFor(db, sub);
  const answers = db.answers.filter((item) => item.submissionId === sub.id);
  let earned = 0;
  let benar = 0;
  let salah = 0;
  let kosong = 0;
  let manual = 0;

  for (const questionId of sub.questionOrder) {
    const question = db.questions.find((q) => q.id === questionId);
    if (!question) continue;
    const answer = answers.find((item) => item.questionId === questionId);
    if (!answer || !hasValue(answer.value)) {
      kosong += 1;
      continue;
    }
    if (question.tipe === 'essay') {
      if (answer.skor === null) manual += 1;
      else earned += answer.skor;
      continue;
    }
    if (answer.benar) benar += 1;
    else salah += 1;
    earned += answer.skor ?? 0;
  }

  sub.skor = total > 0 ? round2((earned / total) * 100) : 0;
  sub.skorMaks = 100;
  sub.benar = benar;
  sub.salah = salah;
  sub.kosong = kosong;
  sub.perluManual = manual;
  sub.status = manual > 0 ? 'needs_grading' : 'graded';
}

function finalize(db: MockDB, sub: MockSubmission, timeout: boolean): void {
  if (sub.status !== 'in_progress') return;
  const answers = db.answers.filter((item) => item.submissionId === sub.id);

  for (const questionId of sub.questionOrder) {
    const question = db.questions.find((q) => q.id === questionId);
    if (!question) continue;
    const answer = answers.find((item) => item.questionId === questionId);
    if (!answer || !hasValue(answer.value)) continue;
    if (question.tipe === 'essay') {
      answer.benar = null;
      answer.skor = null;
      continue;
    }
    const bobot = bobotFor(db, sub.examId, questionId, question.bobot);
    const correct = isCorrect(question, answer.value ?? {});
    answer.benar = correct;
    answer.skor = correct ? bobot : 0;
    answer.updatedAt = nowIso();
  }

  sub.submitAt = nowIso();
  sub.autoSubmitted = timeout;
  sub.lastSeenAt = sub.submitAt;
  sub.durationSec = Math.max(
    0,
    Math.round((new Date(sub.submitAt).getTime() - new Date(sub.mulaiAt).getTime()) / 1000),
  );
  recompute(db, sub);
  if (sub.perluManual === 0) sub.status = 'graded';
  log(db, null, timeout ? 'exam.auto_submit' : 'exam.submit', 'submission', sub.id, {
    skor: sub.skor,
  });
}

function recompute(db: MockDB, sub: MockSubmission): void {
  recomputeSubmission(db, sub);
}

function buildAttempt(db: MockDB, sub: MockSubmission): AttemptPayload {
  const exam = db.exams.find((item) => item.id === sub.examId);
  if (!exam) throw new MockError('NOT_FOUND', 'Ujian tidak ditemukan.');
  const questions: AttemptPayload['questions'] = [];
  sub.questionOrder.forEach((questionId, index) => {
    const question = db.questions.find((q) => q.id === questionId);
    if (!question) return;
    questions.push({
      id: question.id,
      tipe: question.tipe,
      pertanyaan: question.pertanyaan,
      gambarUrl: question.gambarUrl,
      options: question.options,
      bobot: bobotFor(db, exam.id, question.id, question.bobot),
      urutan: index + 1,
    });
  });

  return {
    submission: publicSubmission(db, sub),
    exam: {
      id: exam.id,
      nama: exam.nama,
      mapel: exam.mapel,
      durasiMenit: exam.durasiMenit,
      acakOpsi: exam.acakOpsi,
      tampilkanPembahasan: exam.tampilkanPembahasan,
      tampilkanNilai: exam.tampilkanNilai,
    },
    questions,
    answers: db.answers.filter((item) => item.submissionId === sub.id),
    remainingSec: Math.max(0, Math.floor((new Date(sub.expiresAt).getTime() - Date.now()) / 1000)),
    serverTime: nowIso(),
  };
}

function buildResult(db: MockDB, sub: MockSubmission, withKey: boolean): ResultDetail {
  const exam = db.exams.find((item) => item.id === sub.examId);
  if (!exam) throw new MockError('NOT_FOUND', 'Ujian tidak ditemukan.');
  const answers = db.answers.filter((item) => item.submissionId === sub.id);

  const rows: ResultRow[] = [];
  sub.questionOrder.forEach((questionId, index) => {
    const question = db.questions.find((q) => q.id === questionId);
    if (!question) return;
    const answer = answers.find((item) => item.questionId === questionId) ?? null;
    const bobot = bobotFor(db, exam.id, question.id, question.bobot);
    rows.push({
      nomor: index + 1,
      question: withKey
        ? question
        : { ...question, kunci: undefined, pembahasan: undefined },
      answer,
      bobot,
      skorMaks: bobot,
    });
  });

  return {
    submission: publicSubmission(db, sub),
    exam,
    rows,
    canSeeKey: withKey,
    school: db.settings,
  };
}

function enrichExam(db: MockDB, exam: Exam, student?: MockUserRecord): Exam {
  const owner = db.users.find((item) => item.id === exam.ownerId);
  const questionCount = db.examQuestions.filter((item) => item.examId === exam.id).length;
  const result: Exam = {
    ...exam,
    ownerName: owner?.name ?? exam.ownerName,
    questionCount,
  };
  if (student) {
    const submissions = db.submissions
      .filter((item) => item.examId === exam.id && item.studentId === student.id)
      .sort((a, b) => new Date(b.mulaiAt).getTime() - new Date(a.mulaiAt).getTime());
    const latest = submissions[0];
    result.attemptStatus = latest?.status ?? null;
    result.submissionId = latest?.id ?? null;
    result.requiresToken = Boolean(exam.token);
    delete result.token;
  }
  return result;
}

/* --------------------------------------------------------------- validation */

const ROLES: Role[] = ['admin', 'guru', 'siswa'];
const DIFFICULTIES = ['mudah', 'sedang', 'sulit'];
const TYPES = ['pg', 'pg_kompleks', 'benar_salah', 'isian', 'essay'];

function validateQuestion(input: QuestionInput): void {
  const fail = (message: string): never => {
    throw new MockError('VALIDATION', message);
  };
  if (!input.pertanyaan?.trim()) fail('Pertanyaan wajib diisi.');
  if (!TYPES.includes(input.tipe)) fail('Tipe soal tidak dikenal.');
  if (!DIFFICULTIES.includes(input.tingkat)) fail('Tingkat kesulitan tidak valid.');
  if (!input.kategori?.trim()) fail('Kategori wajib diisi.');
  if (!Number.isFinite(input.bobot) || input.bobot <= 0 || input.bobot > 100) {
    fail('Bobot harus berupa angka 1–100.');
  }
  const labels = new Set<string>();
  for (const option of input.options) {
    if (!option.id?.trim() || !option.teks?.trim()) fail('Setiap opsi harus punya kode dan teks.');
    if (labels.has(option.id)) fail('Kode opsi tidak boleh duplikat.');
    labels.add(option.id);
  }
  if (input.tipe === 'pg' || input.tipe === 'pg_kompleks') {
    if (input.options.length < 2) fail('Minimal 2 opsi jawaban.');
    const selected = input.kunci.selected ?? [];
    if (selected.length === 0) fail('Kunci jawaban wajib dipilih.');
    if (input.tipe === 'pg' && selected.length !== 1) fail('PG hanya boleh punya satu kunci.');
    for (const id of selected) {
      if (!labels.has(id)) fail(`Kunci ${id} tidak ada pada opsi.`);
    }
  }
  if (input.tipe === 'benar_salah' && typeof input.kunci.value !== 'boolean') {
    fail('Kunci benar/salah wajib dipilih.');
  }
  if (input.tipe === 'isian' && (input.kunci.accepted ?? []).filter((v) => v.trim()).length === 0) {
    fail('Isian singkat butuh minimal satu jawaban diterima.');
  }
}

function sanitizeQuestionInput(input: QuestionInput): QuestionInput {
  return {
    tipe: input.tipe,
    pertanyaan: input.pertanyaan.trim(),
    gambarUrl: input.gambarUrl?.trim() || undefined,
    options: input.tipe === 'isian' || input.tipe === 'essay' ? [] : input.options,
    kunci: input.kunci,
    pembahasan: input.pembahasan?.trim() || undefined,
    bobot: Math.round(input.bobot * 100) / 100,
    tingkat: input.tingkat,
    kategori: input.kategori.trim(),
    tags: input.tags.map((tag) => tag.trim()).filter(Boolean),
    aktif: input.aktif,
  };
}

function validateExam(input: ExamInput): void {
  const fail = (message: string): never => {
    throw new MockError('VALIDATION', message);
  };
  if (!input.nama?.trim()) fail('Nama ujian wajib diisi.');
  if (!input.mapel?.trim()) fail('Mata pelajaran wajib diisi.');
  if (!Number.isFinite(input.durasiMenit) || input.durasiMenit < 1 || input.durasiMenit > 480) {
    fail('Durasi harus 1–480 menit.');
  }
  if (!Number.isFinite(input.jumlahSoal) || input.jumlahSoal < 1) fail('Jumlah soal minimal 1.');
  const start = new Date(input.mulaiAt).getTime();
  const end = new Date(input.selesaiAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) fail('Jadwal ujian tidak valid.');
  if (end <= start) fail('Waktu selesai harus setelah waktu mulai.');
}

/* ----------------------------------------------------------------- dispatch */

export async function mockRequest<T>(action: string, rawPayload: Payload): Promise<{
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
  serverTime: string;
}> {
  const db = getDb();
  try {
    if (failNextRequest) {
      failNextRequest = false;
      throw new MockError('INTERNAL', 'Simulasi gangguan server (500). Silakan coba lagi.');
    }
    if (env.mockErrorRate > 0 && Math.random() * 100 < env.mockErrorRate) {
      throw new MockError('INTERNAL', 'Gangguan server acak (mode simulasi error).');
    }
    const data = dispatch(db, action, rawPayload);
    saveDb(db);
    return { ok: true, data: data as T, serverTime: nowIso() };
  } catch (error) {
    if (error instanceof MockError) {
      return {
        ok: false,
        error: { code: error.code, message: error.message, details: error.details },
        serverTime: nowIso(),
      };
    }
    console.error('[mock] unexpected error', error);
    return {
      ok: false,
      error: { code: 'INTERNAL', message: 'Terjadi kesalahan pada mock backend.' },
      serverTime: nowIso(),
    };
  }
}

function dispatch(db: MockDB, action: string, payload: Payload): unknown {
  switch (action) {
    case 'health':
      return { version: 'mock-1.0.0', mode: 'mock', demoPasswordNote: 'Lihat seed.ts' };

    /* ------------------------------------------------------------------ auth */
    case 'auth.login':
      return handleLogin(db, payload);
    case 'auth.google':
      throw new MockError(
        'FORBIDDEN',
        'Login Google tidak tersedia pada mode mock. Isi VITE_GAS_API_URL untuk memakai OAuth asli.',
      );
    case 'auth.refresh':
      return handleRefresh(db, payload);
    case 'auth.me': {
      const user = authenticate(db, payload);
      return { user: publicUser(user) };
    }
    case 'auth.logout': {
      const user = authenticate(db, payload);
      user.tokenVersion += 1;
      user.updatedAt = nowIso();
      log(db, user, 'auth.logout', 'user', user.id);
      return { ok: true };
    }
    case 'auth.changePassword': {
      const user = authenticate(db, payload);
      const current = str(payload.currentCredential);
      const next = str(payload.newCredential);
      if (current !== user.credential) {
        throw new MockError('VALIDATION', 'Kata sandi lama tidak cocok.');
      }
      if (next.length < 20) throw new MockError('VALIDATION', 'Kredensial baru tidak valid.');
      user.credential = next;
      user.tokenVersion += 1;
      user.updatedAt = nowIso();
      log(db, user, 'auth.change_password', 'user', user.id);
      return { ok: true };
    }
    case 'auth.updateProfile': {
      const user = authenticate(db, payload);
      const name = str(payload.name).trim();
      if (!name) throw new MockError('VALIDATION', 'Nama wajib diisi.');
      user.name = name;
      user.avatarUrl = str(payload.avatarUrl) || undefined;
      user.updatedAt = nowIso();
      return { user: publicUser(user) };
    }

    /* ----------------------------------------------------------------- users */
    case 'users.list': {
      authenticate(db, payload, ['admin']);
      const filters = as<{ q?: string; role?: Role | ''; page?: number; pageSize?: number }>(
        payload.filters ?? {},
      );
      const query = (filters.q ?? '').toLowerCase().trim();
      const role = filters.role ?? '';
      const items = db.users
        .filter((user) => (role ? user.role === role : true))
        .filter((user) =>
          query
            ? `${user.name} ${user.email} ${user.nis ?? ''} ${user.kelas ?? ''}`
                .toLowerCase()
                .includes(query)
            : true,
        )
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(publicUser);
      return paginate(items, filters.page, filters.pageSize);
    }
    case 'users.create':
      return handleUserCreate(db, payload);
    case 'users.update':
      return handleUserUpdate(db, payload);
    case 'users.delete': {
      const admin = authenticate(db, payload, ['admin']);
      const id = str(payload.id);
      if (id === admin.id) throw new MockError('VALIDATION', 'Tidak bisa menghapus akun sendiri.');
      const target = db.users.find((user) => user.id === id);
      if (!target) throw new MockError('NOT_FOUND', 'Pengguna tidak ditemukan.');
      if (target.role === 'admin' && db.users.filter((u) => u.role === 'admin').length <= 1) {
        throw new MockError('VALIDATION', 'Minimal harus ada satu admin aktif.');
      }
      db.users = db.users.filter((user) => user.id !== id);
      log(db, admin, 'user.delete', 'user', id, { email: target.email });
      return { ok: true };
    }
    case 'users.resetPassword': {
      const admin = authenticate(db, payload, ['admin']);
      const target = db.users.find((user) => user.id === str(payload.id));
      if (!target) throw new MockError('NOT_FOUND', 'Pengguna tidak ditemukan.');
      const credential = str(payload.credential);
      if (credential.length < 20) throw new MockError('VALIDATION', 'Kredensial tidak valid.');
      target.credential = credential;
      target.tokenVersion += 1;
      target.updatedAt = nowIso();
      log(db, admin, 'user.reset_password', 'user', target.id);
      return { ok: true };
    }

    /* ------------------------------------------------------------- questions */
    case 'questions.list':
      return handleQuestionList(db, payload);
    case 'questions.get': {
      const user = authenticate(db, payload, ['admin', 'guru']);
      const question = db.questions.find((item) => item.id === str(payload.id));
      if (!question) throw new MockError('NOT_FOUND', 'Soal tidak ditemukan.');
      ensureOwner(question.ownerId, user);
      return { question };
    }
    case 'questions.create':
      return handleQuestionCreate(db, payload);
    case 'questions.update':
      return handleQuestionUpdate(db, payload);
    case 'questions.delete': {
      const user = authenticate(db, payload, ['admin', 'guru']);
      const question = db.questions.find((item) => item.id === str(payload.id));
      if (!question) throw new MockError('NOT_FOUND', 'Soal tidak ditemukan.');
      ensureOwner(question.ownerId, user);
      question.aktif = false;
      question.updatedAt = nowIso();
      log(db, user, 'question.delete', 'question', question.id);
      return { ok: true };
    }
    case 'questions.bulkCreate':
      return handleQuestionBulkCreate(db, payload);
    case 'questions.meta': {
      const user = authenticate(db, payload, ['admin', 'guru']);
      const scope = db.questions.filter(
        (item) => item.aktif && (user.role === 'admin' || item.ownerId === user.id),
      );
      return {
        kategori: Array.from(new Set(scope.map((item) => item.kategori))).sort(),
        tags: Array.from(new Set(scope.flatMap((item) => item.tags))).sort(),
      };
    }

    /* ----------------------------------------------------------------- exams */
    case 'exams.list':
      return handleExamList(db, payload);
    case 'exams.get':
      return handleExamGet(db, payload);
    case 'exams.create':
      return handleExamCreate(db, payload);
    case 'exams.update':
      return handleExamUpdate(db, payload);
    case 'exams.delete': {
      const user = authenticate(db, payload, ['admin', 'guru']);
      const exam = db.exams.find((item) => item.id === str(payload.id));
      if (!exam) throw new MockError('NOT_FOUND', 'Ujian tidak ditemukan.');
      ensureOwner(exam.ownerId, user);
      if (db.submissions.some((item) => item.examId === exam.id)) {
        throw new MockError('CONFLICT', 'Ujian sudah memiliki peserta, tutup saja alih-alih menghapus.');
      }
      db.exams = db.exams.filter((item) => item.id !== exam.id);
      db.examQuestions = db.examQuestions.filter((item) => item.examId !== exam.id);
      log(db, user, 'exam.delete', 'exam', exam.id);
      return { ok: true };
    }
    case 'exams.setQuestions':
      return handleSetQuestions(db, payload);
    case 'exams.preview':
      return handleExamGet(db, payload);
    case 'exams.publish':
      return handleExamStatus(db, payload, 'published');
    case 'exams.close':
      return handleExamStatus(db, payload, 'closed');
    case 'exams.assign':
      return handleExamAssign(db, payload);
    case 'exams.info':
      return handleExamInfo(db, payload);

    /* -------------------------------------------------------------- attempts */
    case 'attempts.start':
      return handleAttemptStart(db, payload);
    case 'attempts.get':
      return handleAttemptGet(db, payload);
    case 'attempts.save':
      return handleAttemptSave(db, payload);
    case 'attempts.logEvent':
      return handleAttemptEvent(db, payload);
    case 'attempts.submit':
      return handleAttemptSubmit(db, payload);

    /* ----------------------------------------------------------- submissions */
    case 'submissions.list':
      return handleSubmissionList(db, payload);
    case 'submissions.get':
      return handleSubmissionGet(db, payload);
    case 'submissions.gradeEssay':
      return handleGradeEssay(db, payload);
    case 'submissions.forceSubmit':
      return handleForceSubmit(db, payload);

    /* --------------------------------------------------------------- results */
    case 'results.mine':
      return handleResultsMine(db, payload);
    case 'results.detail':
      return handleResultDetail(db, payload);
    case 'results.list':
      return handleResultsList(db, payload);
    case 'results.exportData':
      return handleExportData(db, payload);
    case 'results.stats':
      return handleStats(db, payload);

    /* ------------------------------------------------------------- dashboard */
    case 'dashboard.stats':
      return handleDashboard(db, payload);

    /* -------------------------------------------------------------- settings */
    case 'settings.get':
      return { settings: db.settings, appName: 'CBT Sekolah' };
    case 'settings.update': {
      const user = authenticate(db, payload, ['admin']);
      const settings = as<SchoolSettings>(payload.settings ?? {});
      db.settings = {
        schoolName: str(settings.schoolName, db.settings.schoolName).trim(),
        schoolAddress: str(settings.schoolAddress, db.settings.schoolAddress).trim(),
        schoolLogoUrl: str(settings.schoolLogoUrl, db.settings.schoolLogoUrl).trim(),
        schoolHeadmaster: str(settings.schoolHeadmaster, db.settings.schoolHeadmaster).trim(),
      };
      log(db, user, 'settings.update', 'settings');
      return { settings: db.settings };
    }

    /* ------------------------------------------------------------------ logs */
    case 'logs.list': {
      authenticate(db, payload, ['admin']);
      return paginate(db.logs, num(payload.page, 1), num(payload.pageSize, 20));
    }

    default:
      throw new MockError('BAD_ACTION', `Action "${action}" tidak dikenal.`);
  }
}

function ensureOwner(ownerId: string, user: MockUserRecord): void {
  if (user.role !== 'admin' && ownerId !== user.id) {
    throw new MockError('FORBIDDEN', 'Anda hanya dapat mengelola data milik sendiri.');
  }
}

/* ---------------------------------------------------------------- auth impl */

function handleLogin(db: MockDB, payload: Payload): AuthSession {
  const email = str(payload.email).trim().toLowerCase();
  const credential = str(payload.credential);
  if (!email || !credential) {
    throw new MockError('VALIDATION', 'Email dan kata sandi wajib diisi.');
  }
  const user = db.users.find((item) => item.email.toLowerCase() === email);
  if (!user || user.credential !== credential) {
    throw new MockError('UNAUTHORIZED', 'Email atau kata sandi salah.');
  }
  if (!user.active) throw new MockError('FORBIDDEN', 'Akun dinonaktifkan. Hubungi admin.');
  log(db, user, 'auth.login', 'user', user.id);
  return sessionFor(user);
}

function handleRefresh(db: MockDB, payload: Payload): AuthSession {
  const token = str(payload.refreshToken);
  if (!token) throw new MockError('UNAUTHORIZED', 'Refresh token tidak ditemukan.');
  const decoded = decodeToken(token);
  if (decoded.typ !== 'refresh') throw new MockError('UNAUTHORIZED', 'Jenis token tidak sesuai.');
  if (decoded.exp < Date.now()) {
    throw new MockError('SESSION_EXPIRED', 'Sesi berakhir. Silakan masuk kembali.');
  }
  const user = db.users.find((item) => item.id === decoded.sub);
  if (!user || !user.active || user.tokenVersion !== decoded.tv) {
    throw new MockError('SESSION_EXPIRED', 'Sesi sudah dicabut. Silakan masuk kembali.');
  }
  return sessionFor(user);
}

function handleUserCreate(db: MockDB, payload: Payload): { user: User } {
  const admin = authenticate(db, payload, ['admin']);
  const input = as<UserInput>(payload.input ?? {});
  if (!input.name?.trim()) throw new MockError('VALIDATION', 'Nama wajib diisi.');
  if (!input.email?.trim() || !input.email.includes('@')) {
    throw new MockError('VALIDATION', 'Email tidak valid.');
  }
  if (!ROLES.includes(input.role)) throw new MockError('VALIDATION', 'Role tidak valid.');
  if (db.users.some((user) => user.email.toLowerCase() === input.email.toLowerCase())) {
    throw new MockError('CONFLICT', 'Email sudah terdaftar.');
  }
  if (!input.credential || input.credential.length < 20) {
    throw new MockError('VALIDATION', 'Kata sandi wajib diisi.');
  }
  const now = nowIso();
  const user: MockUserRecord = {
    id: uid('USR'),
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    role: input.role,
    nis: input.nis?.trim() || undefined,
    kelas: input.kelas?.trim() || undefined,
    avatarUrl: input.avatarUrl,
    active: input.active ?? true,
    credential: input.credential,
    tokenVersion: 0,
    createdAt: now,
    updatedAt: now,
  };
  db.users.push(user);
  log(db, admin, 'user.create', 'user', user.id, { role: user.role });
  return { user: publicUser(user) };
}

function handleUserUpdate(db: MockDB, payload: Payload): { user: User } {
  const admin = authenticate(db, payload, ['admin']);
  const id = str(payload.id);
  const input = as<Partial<UserInput>>(payload.input ?? {});
  const user = db.users.find((item) => item.id === id);
  if (!user) throw new MockError('NOT_FOUND', 'Pengguna tidak ditemukan.');
  if (input.email && input.email.toLowerCase() !== user.email.toLowerCase()) {
    if (db.users.some((item) => item.id !== id && item.email.toLowerCase() === input.email?.toLowerCase())) {
      throw new MockError('CONFLICT', 'Email sudah dipakai pengguna lain.');
    }
    user.email = input.email.toLowerCase();
  }
  if (input.name !== undefined) user.name = input.name.trim();
  if (input.role !== undefined && ROLES.includes(input.role)) user.role = input.role;
  if (input.nis !== undefined) user.nis = input.nis.trim() || undefined;
  if (input.kelas !== undefined) user.kelas = input.kelas.trim() || undefined;
  if (input.active !== undefined) user.active = input.active;
  if (input.avatarUrl !== undefined) user.avatarUrl = input.avatarUrl || undefined;
  if (user.id === admin.id && !user.active) {
    throw new MockError('VALIDATION', 'Tidak bisa menonaktifkan akun sendiri.');
  }
  user.updatedAt = nowIso();
  log(db, admin, 'user.update', 'user', user.id);
  return { user: publicUser(user) };
}

/* ---------------------------------------------------------- questions impl */

function handleQuestionList(db: MockDB, payload: Payload): Paginated<Question> {
  const user = authenticate(db, payload, ['admin', 'guru']);
  const filters = as<{
    q?: string;
    kategori?: string;
    tipe?: string;
    tingkat?: string;
    page?: number;
    pageSize?: number;
  }>(payload.filters ?? {});
  const query = (filters.q ?? '').toLowerCase().trim();
  const items = db.questions
    .filter((item) => item.aktif && (user.role === 'admin' || item.ownerId === user.id))
    .filter((item) => (filters.kategori ? item.kategori === filters.kategori : true))
    .filter((item) => (filters.tipe ? item.tipe === filters.tipe : true))
    .filter((item) => (filters.tingkat ? item.tingkat === filters.tingkat : true))
    .filter((item) =>
      query
        ? `${item.pertanyaan} ${item.kategori} ${item.tags.join(' ')}`.toLowerCase().includes(query)
        : true,
    )
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((item) => ({
      ...item,
      ownerName: db.users.find((user) => user.id === item.ownerId)?.name ?? item.ownerName,
    }));
  return paginate(items, filters.page, filters.pageSize);
}

function handleQuestionCreate(db: MockDB, payload: Payload): { question: Question } {
  const user = authenticate(db, payload, ['admin', 'guru']);
  const raw = as<QuestionInput>(payload.input ?? {});
  validateQuestion(raw);
  const input = sanitizeQuestionInput(raw);
  const now = nowIso();
  const question: Question = {
    ...input,
    id: uid('QST'),
    ownerId: user.id,
    ownerName: user.name,
    createdAt: now,
    updatedAt: now,
  };
  db.questions.unshift(question);
  log(db, user, 'question.create', 'question', question.id, { tipe: question.tipe });
  return { question };
}

function handleQuestionUpdate(db: MockDB, payload: Payload): { question: Question } {
  const user = authenticate(db, payload, ['admin', 'guru']);
  const id = str(payload.id);
  const raw = as<QuestionInput>(payload.input ?? {});
  const question = db.questions.find((item) => item.id === id);
  if (!question) throw new MockError('NOT_FOUND', 'Soal tidak ditemukan.');
  ensureOwner(question.ownerId, user);
  validateQuestion(raw);
  Object.assign(question, sanitizeQuestionInput(raw), { updatedAt: nowIso() });
  log(db, user, 'question.update', 'question', question.id);
  return { question };
}

function handleQuestionBulkCreate(
  db: MockDB,
  payload: Payload,
): { created: number; errors: { index: number; message: string }[] } {
  const user = authenticate(db, payload, ['admin', 'guru']);
  const items = list<QuestionInput>(payload.items);
  if (items.length === 0) throw new MockError('VALIDATION', 'Tidak ada soal untuk diimpor.');
  if (items.length > 50) {
    throw new MockError('VALIDATION', 'Maksimal 50 soal per permintaan. Pecah menjadi beberapa batch.');
  }
  const errors: { index: number; message: string }[] = [];
  let created = 0;
  items.forEach((item, index) => {
    try {
      validateQuestion(item);
      const clean = sanitizeQuestionInput(item);
      const now = nowIso();
      db.questions.unshift({
        ...clean,
        id: uid('QST'),
        ownerId: user.id,
        ownerName: user.name,
        createdAt: now,
        updatedAt: now,
      });
      created += 1;
    } catch (error) {
      errors.push({
        index,
        message: error instanceof Error ? error.message : 'Baris tidak valid.',
      });
    }
  });
  log(db, user, 'question.import', 'question', undefined, { created, failed: errors.length });
  return { created, errors };
}

/* -------------------------------------------------------------- exams impl */

function handleExamList(db: MockDB, payload: Payload): Paginated<Exam> {
  const user = authenticate(db, payload);
  const filters = as<{ q?: string; status?: string; page?: number; pageSize?: number }>(
    payload.filters ?? {},
  );
  const query = (filters.q ?? '').toLowerCase().trim();

  let exams: Exam[];
  if (user.role === 'siswa') {
    exams = db.exams
      .filter((exam) => exam.status === 'published')
      .filter((exam) => new Date(exam.selesaiAt).getTime() >= Date.now())
      .filter(
        (exam) =>
          exam.kelasTarget.length === 0 ||
          (user.kelas ? exam.kelasTarget.includes(user.kelas) : false),
      );
  } else {
    exams = db.exams.filter((exam) => user.role === 'admin' || exam.ownerId === user.id);
  }

  const items = exams
    .filter((exam) => (filters.status ? exam.status === filters.status : true))
    .filter((exam) => (query ? `${exam.nama} ${exam.mapel}`.toLowerCase().includes(query) : true))
    .sort((a, b) => new Date(b.mulaiAt).getTime() - new Date(a.mulaiAt).getTime())
    .map((exam) => enrichExam(db, exam, user.role === 'siswa' ? user : undefined));

  return paginate(items, filters.page, filters.pageSize);
}

function loadExamForStaff(db: MockDB, payload: Payload): { exam: Exam; user: MockUserRecord } {
  const user = authenticate(db, payload, ['admin', 'guru']);
  const exam = db.exams.find((item) => item.id === str(payload.id));
  if (!exam) throw new MockError('NOT_FOUND', 'Ujian tidak ditemukan.');
  ensureOwner(exam.ownerId, user);
  return { exam, user };
}

function handleExamGet(db: MockDB, payload: Payload): { exam: Exam; questions: Question[] } {
  const { exam } = loadExamForStaff(db, payload);
  const questions = db.examQuestions
    .filter((item) => item.examId === exam.id)
    .sort((a, b) => a.urutan - b.urutan)
    .map((item) => db.questions.find((q) => q.id === item.questionId))
    .filter((item): item is Question => Boolean(item));
  return { exam: enrichExam(db, exam), questions };
}

function handleExamCreate(db: MockDB, payload: Payload): { exam: Exam } {
  const user = authenticate(db, payload, ['admin', 'guru']);
  const input = as<ExamInput>(payload.input ?? {});
  validateExam(input);
  const now = nowIso();
  const exam: Exam = {
    ...input,
    id: uid('EXM'),
    ownerId: user.id,
    ownerName: user.name,
    kelasTarget: input.kelasTarget ?? [],
    status: 'draft',
    questionCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  db.exams.unshift(exam);
  log(db, user, 'exam.create', 'exam', exam.id, { nama: exam.nama });
  return { exam: enrichExam(db, exam) };
}

function handleExamUpdate(db: MockDB, payload: Payload): { exam: Exam } {
  const { exam, user } = loadExamForStaff(db, payload);
  const input = as<ExamInput>(payload.input ?? {});
  validateExam(input);
  Object.assign(exam, input, { kelasTarget: input.kelasTarget ?? [], updatedAt: nowIso() });
  log(db, user, 'exam.update', 'exam', exam.id);
  return { exam: enrichExam(db, exam) };
}

function handleSetQuestions(db: MockDB, payload: Payload): { count: number } {
  const user = authenticate(db, payload, ['admin', 'guru']);
  const exam = db.exams.find((item) => item.id === str(payload.examId));
  if (!exam) throw new MockError('NOT_FOUND', 'Ujian tidak ditemukan.');
  ensureOwner(exam.ownerId, user);
  const ids = list<string>(payload.questionIds).filter(
    (id, index, all) => all.indexOf(id) === index,
  );
  if (ids.length === 0) throw new MockError('VALIDATION', 'Pilih minimal satu soal.');
  for (const id of ids) {
    const question = db.questions.find((item) => item.id === id && item.aktif);
    if (!question) throw new MockError('VALIDATION', `Soal ${id} tidak ditemukan.`);
    if (user.role !== 'admin' && question.ownerId !== user.id) {
      throw new MockError('FORBIDDEN', 'Terdapat soal milik guru lain dalam pilihan Anda.');
    }
  }
  db.examQuestions = db.examQuestions.filter((item) => item.examId !== exam.id);
  ids.forEach((questionId, index) => {
    const question = db.questions.find((item) => item.id === questionId);
    db.examQuestions.push({
      id: uid('EXQ'),
      examId: exam.id,
      questionId,
      urutan: index + 1,
      bobot: question?.bobot ?? 1,
    });
  });
  exam.jumlahSoal = Math.min(exam.jumlahSoal, ids.length);
  exam.updatedAt = nowIso();
  log(db, user, 'exam.set_questions', 'exam', exam.id, { count: ids.length });
  return { count: ids.length };
}

function handleExamStatus(
  db: MockDB,
  payload: Payload,
  status: 'published' | 'closed',
): { exam: Exam } {
  const { exam, user } = loadExamForStaff(db, payload);
  if (status === 'published') {
    const count = db.examQuestions.filter((item) => item.examId === exam.id).length;
    if (count === 0) throw new MockError('VALIDATION', 'Tambahkan soal sebelum menerbitkan ujian.');
    exam.status = 'published';
  } else {
    exam.status = 'closed';
  }
  exam.updatedAt = nowIso();
  log(db, user, `exam.${status}`, 'exam', exam.id);
  return { exam: enrichExam(db, exam) };
}

function handleExamAssign(db: MockDB, payload: Payload): { exam: Exam } {
  const { exam, user } = loadExamForStaff(db, payload);
  exam.kelasTarget = list<string>(payload.kelas).map((item) => item.trim()).filter(Boolean);
  exam.updatedAt = nowIso();
  log(db, user, 'exam.assign', 'exam', exam.id, { kelas: exam.kelasTarget });
  return { exam: enrichExam(db, exam) };
}

/** Student-safe exam metadata used by the pre-exam instructions screen. */
function handleExamInfo(db: MockDB, payload: Payload): { exam: Exam } {
  const user = authenticate(db, payload, ['siswa']);
  const exam = db.exams.find((item) => item.id === str(payload.id));
  if (!exam) throw new MockError('NOT_FOUND', 'Ujian tidak ditemukan.');
  if (exam.status !== 'published') {
    throw new MockError('FORBIDDEN', 'Ujian belum dibuka atau sudah ditutup.');
  }
  if (exam.kelasTarget.length > 0 && (!user.kelas || !exam.kelasTarget.includes(user.kelas))) {
    throw new MockError('FORBIDDEN', 'Ujian ini tidak ditujukan untuk kelas Anda.');
  }
  return { exam: enrichExam(db, exam, user) };
}

/* ----------------------------------------------------------- attempts impl */

function loadStudentSubmission(
  db: MockDB,
  payload: Payload,
): { user: MockUserRecord; sub: MockSubmission } {
  const user = authenticate(db, payload, ['siswa']);
  const sub = db.submissions.find((item) => item.id === str(payload.submissionId));
  if (!sub) throw new MockError('NOT_FOUND', 'Sesi ujian tidak ditemukan.');
  if (sub.studentId !== user.id) throw new MockError('FORBIDDEN', 'Ini bukan sesi ujian Anda.');
  return { user, sub };
}

function handleAttemptStart(db: MockDB, payload: Payload): AttemptPayload {
  const user = authenticate(db, payload, ['siswa']);
  const exam = db.exams.find((item) => item.id === str(payload.examId));
  if (!exam) throw new MockError('NOT_FOUND', 'Ujian tidak ditemukan.');
  const now = Date.now();
  if (exam.status !== 'published') throw new MockError('FORBIDDEN', 'Ujian belum dibuka atau sudah ditutup.');
  if (new Date(exam.mulaiAt).getTime() > now) {
    throw new MockError('EXAM_NOT_STARTED', 'Ujian belum dimulai.');
  }
  if (new Date(exam.selesaiAt).getTime() < now) {
    throw new MockError('EXAM_ENDED', 'Waktu ujian sudah berakhir.');
  }
  if (exam.kelasTarget.length > 0 && (!user.kelas || !exam.kelasTarget.includes(user.kelas))) {
    throw new MockError('FORBIDDEN', 'Ujian ini tidak ditujukan untuk kelas Anda.');
  }
  if (exam.token && exam.token.trim().toLowerCase() !== str(payload.examToken).trim().toLowerCase()) {
    throw new MockError('INVALID_TOKEN', 'Token ujian salah.');
  }
  if (exam.jumlahSoal > 0 && db.examQuestions.filter((item) => item.examId === exam.id).length === 0) {
    throw new MockError('NO_QUESTIONS', 'Ujian belum memiliki soal.');
  }

  const existing = db.submissions.find(
    (item) => item.examId === exam.id && item.studentId === user.id,
  );
  if (existing) {
    if (existing.status === 'in_progress' && new Date(existing.expiresAt).getTime() > now) {
      return buildAttempt(db, existing);
    }
    if (existing.status === 'in_progress') {
      finalize(db, existing, true);
    }
    throw new MockError('ALREADY_SUBMITTED', 'Anda sudah menyelesaikan ujian ini.', {
      submissionId: existing.id,
    });
  }

  const pool = examQuestionsFor(db, exam.id);
  if (pool.length === 0) throw new MockError('NO_QUESTIONS', 'Ujian belum memiliki soal.');
  let ordered = pool.map((item) => item.question.id);
  if (exam.acakSoal) {
    // Fisher–Yates with crypto randomness; order is persisted for resume consistency.
    for (let i = ordered.length - 1; i > 0; i -= 1) {
      const buffer = new Uint32Array(1);
      crypto.getRandomValues(buffer);
      const j = (buffer[0] ?? 0) % (i + 1);
      [ordered[i], ordered[j]] = [ordered[j] as string, ordered[i] as string];
    }
  }
  const limit = Math.max(1, Math.min(exam.jumlahSoal || ordered.length, ordered.length));
  ordered = ordered.slice(0, limit);

  const expiresAt = new Date(
    Math.min(now + exam.durasiMenit * 60_000, new Date(exam.selesaiAt).getTime()),
  ).toISOString();
  const submission: MockSubmission = {
    id: uid('SUB'),
    examId: exam.id,
    examName: exam.nama,
    studentId: user.id,
    studentName: user.name,
    studentNis: user.nis,
    kelas: user.kelas,
    mulaiAt: new Date(now).toISOString(),
    expiresAt,
    status: 'in_progress',
    skor: 0,
    skorMaks: 100,
    benar: 0,
    salah: 0,
    kosong: 0,
    perluManual: 0,
    tabSwitchCount: 0,
    autoSubmitted: false,
    lastSeenAt: new Date(now).toISOString(),
    questionOrder: ordered,
  };
  db.submissions.push(submission);
  log(db, user, 'exam.start', 'submission', submission.id, { examId: exam.id });
  return buildAttempt(db, submission);
}

function handleAttemptGet(db: MockDB, payload: Payload): AttemptPayload {
  const { sub } = loadStudentSubmission(db, payload);
  if (sub.status === 'in_progress' && Date.now() > new Date(sub.expiresAt).getTime() + GRACE_MS) {
    finalize(db, sub, true);
  }
  return buildAttempt(db, sub);
}

function handleAttemptSave(db: MockDB, payload: Payload): SaveAttemptResult {
  const { user, sub } = loadStudentSubmission(db, payload);
  if (sub.status !== 'in_progress') {
    return {
      saved: [],
      remainingSec: 0,
      serverTime: nowIso(),
      status: sub.status,
      tabSwitchCount: sub.tabSwitchCount,
    };
  }

  const remaining = Math.max(0, Math.floor((new Date(sub.expiresAt).getTime() - Date.now()) / 1000));
  if (remaining <= 0 && Date.now() > new Date(sub.expiresAt).getTime() + GRACE_MS) {
    finalize(db, sub, true);
    return {
      saved: [],
      remainingSec: 0,
      serverTime: nowIso(),
      status: sub.status,
      tabSwitchCount: sub.tabSwitchCount,
    };
  }

  const incoming = list<{ questionId: string; value: AnswerValue | null; ragu: boolean }>(
    payload.answers,
  );
  if (incoming.length > 100) {
    throw new MockError('VALIDATION', 'Terlalu banyak jawaban dalam satu permintaan.');
  }
  const saved: string[] = [];
  for (const item of incoming) {
    if (!sub.questionOrder.includes(item.questionId)) continue;
    const question = db.questions.find((q) => q.id === item.questionId);
    if (!question) continue;
    const value = sanitizeAnswer(question, item.value);
    let answer = db.answers.find(
      (existing) => existing.submissionId === sub.id && existing.questionId === item.questionId,
    );
    if (!answer) {
      answer = {
        id: uid('ANS'),
        submissionId: sub.id,
        examId: sub.examId,
        userId: user.id,
        questionId: item.questionId,
        value,
        ragu: Boolean(item.ragu),
        benar: null,
        skor: null,
        updatedAt: nowIso(),
      };
      db.answers.push(answer);
    } else {
      answer.value = value;
      answer.ragu = Boolean(item.ragu);
      answer.updatedAt = nowIso();
    }
    saved.push(item.questionId);
  }

  sub.lastSeenAt = nowIso();
  const remainingAfter = Math.max(
    0,
    Math.floor((new Date(sub.expiresAt).getTime() - Date.now()) / 1000),
  );
  if (remainingAfter === 0 && Date.now() > new Date(sub.expiresAt).getTime() + GRACE_MS) {
    finalize(db, sub, true);
  }

  return {
    saved,
    remainingSec: remainingAfter,
    serverTime: nowIso(),
    status: sub.status,
    tabSwitchCount: sub.tabSwitchCount,
  };
}

function sanitizeAnswer(question: Question, value: AnswerValue | null): AnswerValue | null {
  if (!value) return null;
  if (question.tipe === 'pg' || question.tipe === 'pg_kompleks') {
    const allowed = new Set(question.options.map((option) => option.id));
    const selected = (value.selected ?? []).filter((id) => allowed.has(id));
    if (question.tipe === 'pg') return selected.length > 0 ? { selected: [selected[0] as string] } : null;
    return selected.length > 0 ? { selected } : null;
  }
  if (question.tipe === 'benar_salah') {
    return typeof value.value === 'boolean' ? { value: value.value } : null;
  }
  if (question.tipe === 'isian') {
    const text = (value.text ?? '').slice(0, 500).trim();
    return text ? { text } : null;
  }
  const text = (value.text ?? '').slice(0, 10_000);
  return text.trim() ? { text } : null;
}

function handleAttemptEvent(db: MockDB, payload: Payload): { tabSwitchCount: number } {
  const { user, sub } = loadStudentSubmission(db, payload);
  const event = str(payload.event) || 'unknown';
  if (!['tab_switch', 'blur', 'copy', 'fullscreen_exit', 'paste', 'contextmenu'].includes(event)) {
    throw new MockError('VALIDATION', 'Jenis event tidak dikenal.');
  }
  if (event === 'tab_switch') {
    sub.tabSwitchCount += 1;
    sub.lastSeenAt = nowIso();
  }
  log(db, user, 'exam.event', 'submission', sub.id, { event, total: sub.tabSwitchCount });
  return { tabSwitchCount: sub.tabSwitchCount };
}

function handleAttemptSubmit(db: MockDB, payload: Payload): { submission: Submission } {
  const { sub } = loadStudentSubmission(db, payload);
  if (sub.status === 'in_progress') {
    const expired = Date.now() > new Date(sub.expiresAt).getTime();
    finalize(db, sub, expired);
  }
  return { submission: publicSubmission(db, sub) };
}

/* -------------------------------------------------------- submissions impl */

function handleSubmissionList(db: MockDB, payload: Payload): Paginated<Submission> {
  const user = authenticate(db, payload, ['admin', 'guru']);
  const filters = as<{ examId?: string; status?: string; page?: number; pageSize?: number }>(
    payload.filters ?? {},
  );
  const myExamIds = new Set(
    db.exams
      .filter((exam) => user.role === 'admin' || exam.ownerId === user.id)
      .map((exam) => exam.id),
  );
  const items = db.submissions
    .filter((sub) => myExamIds.has(sub.examId))
    .filter((sub) => (filters.examId ? sub.examId === filters.examId : true))
    .filter((sub) => (filters.status ? sub.status === filters.status : true))
    .filter((sub) => (filters.status ? true : sub.status !== 'in_progress'))
    .sort((a, b) => {
      const left = new Date(a.submitAt ?? a.mulaiAt).getTime();
      const right = new Date(b.submitAt ?? b.mulaiAt).getTime();
      return right - left;
    })
    .map((sub) => publicSubmission(db, sub));
  return paginate(items, filters.page, filters.pageSize);
}

function loadSubmissionForStaff(
  db: MockDB,
  payload: Payload,
): { user: MockUserRecord; sub: MockSubmission; exam: Exam } {
  const user = authenticate(db, payload, ['admin', 'guru']);
  const sub = db.submissions.find((item) => item.id === str(payload.submissionId));
  if (!sub) throw new MockError('NOT_FOUND', 'Data pengerjaan tidak ditemukan.');
  const exam = db.exams.find((item) => item.id === sub.examId);
  if (!exam) throw new MockError('NOT_FOUND', 'Ujian tidak ditemukan.');
  ensureOwner(exam.ownerId, user);
  return { user, sub, exam };
}

function handleSubmissionGet(db: MockDB, payload: Payload): ResultDetail {
  const { sub } = loadSubmissionForStaff(db, payload);
  return buildResult(db, sub, true);
}

function handleGradeEssay(db: MockDB, payload: Payload): { submission: Submission } {
  const { user, sub, exam } = loadSubmissionForStaff(db, payload);
  if (sub.status !== 'needs_grading' && sub.status !== 'graded' && sub.status !== 'submitted') {
    throw new MockError('VALIDATION', 'Pengerjaan ini belum dikumpulkan.');
  }
  const items = list<GradeItem>(payload.items);
  if (items.length === 0) throw new MockError('VALIDATION', 'Tidak ada nilai yang dikirim.');
  for (const item of items) {
    const answer = db.answers.find(
      (entry) => entry.id === item.answerId && entry.submissionId === sub.id,
    );
    if (!answer) throw new MockError('NOT_FOUND', 'Jawaban tidak ditemukan.');
    const question = db.questions.find((q) => q.id === answer.questionId);
    if (!question || question.tipe !== 'essay') {
      throw new MockError('VALIDATION', 'Hanya jawaban essay yang dapat dinilai manual.');
    }
    const bobot = bobotFor(db, exam.id, question.id, question.bobot);
    const skor = Math.max(0, Math.min(bobot, round2(num(item.skor, 0))));
    answer.skor = skor;
    answer.benar = skor >= bobot;
    answer.dinilaiOleh = user.id;
    answer.dinilaiAt = nowIso();
    answer.updatedAt = nowIso();
  }
  recompute(db, sub);
  sub.status = sub.perluManual > 0 ? 'needs_grading' : 'graded';
  log(db, user, 'submission.grade_essay', 'submission', sub.id, { skor: sub.skor });
  return { submission: publicSubmission(db, sub) };
}

function handleForceSubmit(db: MockDB, payload: Payload): { submission: Submission } {
  const { user, sub } = loadSubmissionForStaff(db, payload);
  if (sub.status === 'in_progress') {
    finalize(db, sub, false);
    log(db, user, 'submission.force_submit', 'submission', sub.id);
  }
  return { submission: publicSubmission(db, sub) };
}

/* ------------------------------------------------------------- results impl */

function handleResultsMine(db: MockDB, payload: Payload): { items: Submission[] } {
  const user = authenticate(db, payload, ['siswa']);
  const items = db.submissions
    .filter((sub) => sub.studentId === user.id && sub.status !== 'in_progress')
    .sort((a, b) => new Date(b.submitAt ?? b.mulaiAt).getTime() - new Date(a.submitAt ?? a.mulaiAt).getTime())
    .map((sub) => publicSubmission(db, sub));
  return { items };
}

function handleResultDetail(db: MockDB, payload: Payload): ResultDetail {
  const user = authenticate(db, payload);
  const sub = db.submissions.find((item) => item.id === str(payload.submissionId));
  if (!sub) throw new MockError('NOT_FOUND', 'Data pengerjaan tidak ditemukan.');
  if (user.role === 'siswa' && sub.studentId !== user.id) {
    throw new MockError('FORBIDDEN', 'Ini bukan hasil ujian Anda.');
  }
  const exam = db.exams.find((item) => item.id === sub.examId);
  if (!exam) throw new MockError('NOT_FOUND', 'Ujian tidak ditemukan.');
  if (user.role !== 'siswa') ensureOwner(exam.ownerId, user);
  if (user.role === 'siswa' && !exam.tampilkanNilai && exam.status !== 'closed') {
    throw new MockError('RESULT_HIDDEN', 'Nilai belum dibuka oleh guru.');
  }
  const detail = buildResult(db, sub, user.role !== 'siswa' || exam.tampilkanPembahasan);
  // Never expose the exam token to a student, even after submission.
  if (user.role === 'siswa') delete detail.exam.token;
  return detail;
}

function handleResultsList(db: MockDB, payload: Payload): { items: Submission[] } {
  const user = authenticate(db, payload, ['admin', 'guru']);
  const examId = str(payload.examId);
  const exam = db.exams.find((item) => item.id === examId);
  if (!exam) throw new MockError('NOT_FOUND', 'Ujian tidak ditemukan.');
  ensureOwner(exam.ownerId, user);
  const items = db.submissions
    .filter((sub) => sub.examId === examId && sub.status !== 'in_progress')
    .sort((a, b) => b.skor - a.skor)
    .map((sub) => publicSubmission(db, sub));
  return { items };
}

export const KKM = 75;

function computeStats(db: MockDB, exam: Exam): ExamStats {
  const subs = db.submissions.filter(
    (sub) => sub.examId === exam.id && sub.status !== 'in_progress',
  );
  const scores = subs.map((sub) => sub.skor);
  const count = scores.length;
  const avg = count > 0 ? round2(scores.reduce((a, b) => a + b, 0) / count) : 0;
  const min = count > 0 ? Math.min(...scores) : 0;
  const max = count > 0 ? Math.max(...scores) : 0;
  const passed = scores.filter((score) => score >= KKM).length;

  const buckets = [
    { label: '<60', min: 0, max: 59.999 },
    { label: '60-69', min: 60, max: 69.999 },
    { label: '70-79', min: 70, max: 79.999 },
    { label: '80-89', min: 80, max: 89.999 },
    { label: '90-100', min: 90, max: 100 },
  ];
  const distribution = buckets.map((bucket) => ({
    label: bucket.label,
    value: scores.filter((score) => score >= bucket.min && score <= bucket.max).length,
  }));

  const perQuestion = examQuestionsFor(db, exam.id).map(({ question }, index) => {
    const answers = db.answers.filter(
      (answer) =>
        answer.examId === exam.id &&
        answer.questionId === question.id &&
        subs.some((sub) => sub.id === answer.submissionId),
    );
    const answered = answers.filter((answer) => hasValue(answer.value));
    const benar = answered.filter((answer) => answer.benar === true).length;
    const salah = answered.filter((answer) => answer.benar === false).length;
    const kosong = Math.max(0, count - answered.length);
    return {
      questionId: question.id,
      nomor: index + 1,
      pertanyaan: question.pertanyaan,
      benar,
      salah,
      kosong,
    };
  });

  return { count, avg, min, max, passed, distribution, perQuestion };
}

function handleStats(db: MockDB, payload: Payload): ExamStats {
  const user = authenticate(db, payload, ['admin', 'guru']);
  const exam = db.exams.find((item) => item.id === str(payload.examId));
  if (!exam) throw new MockError('NOT_FOUND', 'Ujian tidak ditemukan.');
  ensureOwner(exam.ownerId, user);
  return computeStats(db, exam);
}

function handleExportData(db: MockDB, payload: Payload): ExportPayload {
  const user = authenticate(db, payload, ['admin', 'guru']);
  const exam = db.exams.find((item) => item.id === str(payload.examId));
  if (!exam) throw new MockError('NOT_FOUND', 'Ujian tidak ditemukan.');
  ensureOwner(exam.ownerId, user);
  const subs = db.submissions
    .filter((sub) => sub.examId === exam.id && sub.status !== 'in_progress')
    .sort((a, b) => (a.studentNis ?? '').localeCompare(b.studentNis ?? ''));
  const rows: ExportRow[] = subs.map((sub, index) => {
    const student = db.users.find((item) => item.id === sub.studentId);
    return {
      no: index + 1,
      nis: student?.nis ?? '',
      nama: student?.name ?? '',
      kelas: student?.kelas ?? '',
      skor: sub.skor,
      status: sub.status,
      benar: sub.benar,
      salah: sub.salah,
      kosong: sub.kosong,
      submitAt: sub.submitAt ?? '',
      durasi: formatDuration(sub.durationSec),
    };
  });
  return {
    exam: enrichExam(db, exam),
    school: db.settings,
    rows,
    stats: computeStats(db, exam),
    generatedAt: nowIso(),
  };
}

/* ----------------------------------------------------------- dashboard impl */

function last7Days(): { key: string; label: string }[] {
  const days: { key: string; label: string }[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(Date.now() - i * 86_400_000);
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(date);
    const label = new Intl.DateTimeFormat('id-ID', {
      weekday: 'short',
      timeZone: 'Asia/Jakarta',
    }).format(date);
    days.push({ key, label });
  }
  return days;
}

function submissionsPerDay(subs: MockSubmission[]): { label: string; value: number }[] {
  return last7Days().map((day) => ({
    label: day.label,
    value: subs.filter((sub) => {
      if (!sub.submitAt) return false;
      const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(
        new Date(sub.submitAt),
      );
      return key === day.key;
    }).length,
  }));
}

function handleDashboard(db: MockDB, payload: Payload): DashboardStats {
  const user = authenticate(db, payload);
  const now = Date.now();
  const visibleExams = db.exams.filter(
    (exam) => user.role === 'admin' || (user.role === 'guru' ? exam.ownerId === user.id : true),
  );
  const examIds = new Set(visibleExams.map((exam) => exam.id));
  const submissions = db.submissions.filter((sub) => examIds.has(sub.examId));
  const completed = submissions.filter((sub) => sub.status !== 'in_progress');
  const upcomingExams = visibleExams
    .filter(
      (exam) =>
        exam.status === 'published' &&
        new Date(exam.selesaiAt).getTime() >= now &&
        (user.role !== 'siswa' ||
          exam.kelasTarget.length === 0 ||
          (user.kelas ? exam.kelasTarget.includes(user.kelas) : false)),
    )
    .sort((a, b) => new Date(a.mulaiAt).getTime() - new Date(b.mulaiAt).getTime())
    .slice(0, 5)
    .map((exam) => enrichExam(db, exam, user.role === 'siswa' ? user : undefined));

  if (user.role === 'admin') {
    return {
      cards: [
        { label: 'Total Pengguna', value: String(db.users.length), icon: 'users', hint: `${db.users.filter((u) => u.role === 'guru').length} guru, ${db.users.filter((u) => u.role === 'siswa').length} siswa` },
        { label: 'Ujian Aktif', value: String(db.exams.filter((e) => e.status === 'published' && new Date(e.selesaiAt).getTime() >= now).length), icon: 'exams', hint: `${db.exams.length} total ujian` },
        { label: 'Bank Soal', value: String(db.questions.filter((q) => q.aktif).length), icon: 'questions' },
        { label: 'Pengerjaan', value: String(completed.length), icon: 'submissions', hint: `${submissions.filter((s) => s.status === 'needs_grading').length} perlu dinilai` },
      ],
      chart: submissionsPerDay(completed),
      upcomingExams,
      recentSubmissions: completed
        .slice()
        .sort((a, b) => new Date(b.submitAt ?? b.mulaiAt).getTime() - new Date(a.submitAt ?? a.mulaiAt).getTime())
        .slice(0, 5)
        .map((sub) => publicSubmission(db, sub)),
      pendingGrading: completed
        .filter((sub) => sub.status === 'needs_grading')
        .slice(0, 5)
        .map((sub) => publicSubmission(db, sub)),
    };
  }

  if (user.role === 'guru') {
    const mySubs = completed;
    const avg = mySubs.length
      ? round2(mySubs.reduce((sum, sub) => sum + sub.skor, 0) / mySubs.length)
      : 0;
    const pending = mySubs.filter((sub) => sub.status === 'needs_grading');
    return {
      cards: [
        { label: 'Ujian Saya', value: String(visibleExams.length), icon: 'exams', hint: `${visibleExams.filter((e) => e.status === 'published').length} terbit` },
        { label: 'Soal Saya', value: String(db.questions.filter((q) => q.aktif && q.ownerId === user.id).length), icon: 'questions' },
        { label: 'Perlu Dinilai', value: String(pending.length), icon: 'submissions', hint: 'Jawaban essay' },
        { label: 'Rata-rata Nilai', value: String(avg), icon: 'score', hint: `${mySubs.length} pengerjaan` },
      ],
      chart: submissionsPerDay(mySubs),
      upcomingExams,
      recentSubmissions: mySubs
        .slice()
        .sort((a, b) => new Date(b.submitAt ?? b.mulaiAt).getTime() - new Date(a.submitAt ?? a.mulaiAt).getTime())
        .slice(0, 5)
        .map((sub) => publicSubmission(db, sub)),
      pendingGrading: pending.slice(0, 5).map((sub) => publicSubmission(db, sub)),
    };
  }

  const myCompleted = completed.filter((sub) => sub.studentId === user.id);
  const scores = myCompleted.map((sub) => sub.skor);
  const avg = scores.length ? round2(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const best = scores.length ? Math.max(...scores) : 0;
  return {
    cards: [
      { label: 'Ujian Tersedia', value: String(upcomingExams.length), icon: 'exams' },
      { label: 'Ujian Selesai', value: String(myCompleted.length), icon: 'submissions' },
      { label: 'Rata-rata Nilai', value: String(avg), icon: 'score' },
      { label: 'Nilai Terbaik', value: String(best), icon: 'score' },
    ],
    chart: submissionsPerDay(myCompleted),
    upcomingExams,
    recentSubmissions: myCompleted
      .slice()
      .sort((a, b) => new Date(b.submitAt ?? b.mulaiAt).getTime() - new Date(a.submitAt ?? a.mulaiAt).getTime())
      .slice(0, 5)
      .map((sub) => publicSubmission(db, sub)),
    pendingGrading: [],
  };
}

export type { MockDB };
