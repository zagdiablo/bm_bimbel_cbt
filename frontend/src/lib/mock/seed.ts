import type { Answer, Exam, ExamQuestion, LogEntry, Question } from '@/types/domain';
import type { MockDB, MockSubmission, MockUserRecord } from './db';

const DEMO_PASSWORD_NOTE = 'Demo password: Admin#123 / Guru#123 / Siswa#123';

function iso(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * Demo credentials are PBKDF2 verifiers (100k iterations, salt `cbt:v1:<email>`)
 * generated offline so the seed does not need to block on Web Crypto.
 */
const SEED_CREDENTIALS: Record<string, string> = {
  'admin@cbt.local': 'gjqOCiRuNOCRvTcR3UM5YdeluqIrX6Z0XQ5rZYdzIOo=',
  'guru@cbt.local': '2u9Iu/3nsvgp4Hx6+npm9nfDIS2ZTVodYOWUC5Pphbo=',
  'siswa@cbt.local': 'IanebL5A8SHWj9uoYyR2eV7XwDTWJ8pDyW2ESZiJ/v0=',
  'siswa2@cbt.local': 'Y/d1rM6ulaUK7EwE5fpyr8EvEcPBPz3+r5JCC3eI4+g=',
  'siswa3@cbt.local': 'Mf4ZhfffDP0t4POf4XAtV57MeD+Mw3d/0p/hYTRWYfg=',
};

function user(
  id: string,
  email: string,
  name: string,
  role: MockUserRecord['role'],
  extra: Partial<MockUserRecord> = {},
): MockUserRecord {
  const now = iso();
  return {
    id,
    email,
    name,
    role,
    active: true,
    createdAt: now,
    updatedAt: now,
    credential: SEED_CREDENTIALS[email] ?? '',
    tokenVersion: 0,
    ...extra,
  };
}

function q(
  id: string,
  tipe: Question['tipe'],
  pertanyaan: string,
  options: Question['options'],
  kunci: Question['kunci'],
  meta: Partial<Question> = {},
): Question {
  const now = iso();
  return {
    id,
    ownerId: 'USR-guru',
    ownerName: 'Budi Santoso, S.Pd.',
    tipe,
    pertanyaan,
    options,
    kunci,
    bobot: 1,
    tingkat: 'sedang',
    kategori: 'Matematika',
    tags: [],
    aktif: true,
    createdAt: now,
    updatedAt: now,
    ...meta,
  };
}

const OPT = (...items: string[]): Question['options'] =>
  items.map((teks, index) => ({ id: String.fromCharCode(65 + index), teks }));

const PG_OPTIONS = OPT('16', '25', '32', '64', '128');
const PG2_OPTIONS = OPT('1', '2', '3', '-2', '-3');
const PG3_OPTIONS = OPT('{1, 6}', '{2, 3}', '{-2, -3}', '{2, -3}', '{1, 5}');
const PG4_OPTIONS = OPT('0', '1/2', '1/2 √2', '1/2 √3', '1');
const PG5_OPTIONS = OPT('14 cm', '21 cm', '28 cm', '35 cm', '49 cm');

function seedQuestions(): Question[] {
  return [
    q('QST-eksponen', 'pg', 'Hasil dari 2^5 adalah ...', PG_OPTIONS, { selected: ['C'] }, {
      tingkat: 'mudah',
      tags: ['eksponen', 'pangkat'],
      pembahasan: '2^5 = 2 × 2 × 2 × 2 × 2 = 32.',
    }),
    q('QST-gradien', 'pg', 'Gradien garis dengan persamaan y = 2x + 3 adalah ...', PG2_OPTIONS, {
      selected: ['B'],
    }, {
      tags: ['gradien', 'persamaan-garis'],
      pembahasan: 'Bentuk y = mx + c memiliki gradien m = 2.',
    }),
    q('QST-kuadrat', 'pg', 'Himpunan penyelesaian dari x^2 − 5x + 6 = 0 adalah ...', PG3_OPTIONS, {
      selected: ['B'],
    }, {
      tags: ['persamaan-kuadrat'],
      pembahasan: 'x^2 − 5x + 6 = (x − 2)(x − 3), sehingga x = 2 atau x = 3.',
    }),
    q('QST-trigonometri', 'pg', 'Nilai sin 30° adalah ...', PG4_OPTIONS, { selected: ['B'] }, {
      tingkat: 'mudah',
      kategori: 'Matematika',
      tags: ['trigonometri'],
      pembahasan: 'sin 30° = 1/2.',
    }),
    q('QST-keliling', 'pg', 'Keliling persegi dengan panjang sisi 7 cm adalah ...', PG5_OPTIONS, {
      selected: ['C'],
    }, {
      tingkat: 'mudah',
      tags: ['geometri'],
      pembahasan: 'Keliling persegi = 4 × s = 4 × 7 = 28 cm.',
    }),
    q(
      'QST-faktor',
      'pg_kompleks',
      'Manakah bilangan berikut yang merupakan faktor dari 12? (Pilih semua yang benar)',
      OPT('2', '3', '4', '5', '6'),
      { selected: ['A', 'B', 'C', 'E'] },
      { bobot: 2, tags: ['faktor', 'bilangan'] },
    ),
    q(
      'QST-genap',
      'benar_salah',
      'Bilangan 0 termasuk bilangan genap.',
      OPT('Benar', 'Salah'),
      { value: true },
      { tingkat: 'mudah', tags: ['bilangan'] },
    ),
    q('QST-ibukota', 'isian', 'Ibu kota Indonesia adalah ...', [], {
      accepted: ['jakarta', 'dki jakarta'],
    }, { bobot: 2, tingkat: 'mudah', tags: ['geografi'], kategori: 'IPS' }),
    q(
      'QST-essay',
      'essay',
      'Jelaskan langkah-langkah menyelesaikan persamaan linear satu variabel 3x + 5 = 20.',
      [],
      { rubrik: 'Langkah memindahkan konstanta, membagi koefisien, dan menuliskan x = 5.' },
      { bobot: 5, tingkat: 'sulit', tags: ['aljabar'] },
    ),
  ];
}

function seedExams(): { exams: Exam[]; examQuestions: ExamQuestion[] } {
  const base = {
    ownerId: 'USR-guru',
    ownerName: 'Budi Santoso, S.Pd.',
    mapel: 'Matematika',
    acakSoal: false,
    acakOpsi: true,
    tampilkanPembahasan: true,
    tampilkanNilai: true,
    kelasTarget: ['XII-IPA-1', 'XII-IPA-2'],
    createdAt: iso(-2 * DAY),
    updatedAt: iso(-2 * DAY),
    questionCount: 5,
  };

  const demo: Exam = {
    ...base,
    id: 'EXM-demo',
    nama: 'Ujian Demo Matematika',
    deskripsi: 'Ujian demo untuk mencoba alur CBT dari login sampai melihat nilai.',
    durasiMenit: 30,
    mulaiAt: iso(-2 * HOUR),
    selesaiAt: iso(7 * DAY),
    jumlahSoal: 5,
    status: 'published',
  };

  const aljabar: Exam = {
    ...base,
    id: 'EXM-aljabar',
    nama: 'Ulangan Harian Aljabar',
    deskripsi: 'Ulangan yang sudah selesai, dipakai untuk contoh riwayat dan rekap nilai.',
    durasiMenit: 20,
    mulaiAt: iso(-5 * DAY),
    selesaiAt: iso(-4 * DAY),
    jumlahSoal: 5,
    status: 'closed',
    createdAt: iso(-8 * DAY),
    updatedAt: iso(-4 * DAY),
  };

  const ids = ['QST-eksponen', 'QST-gradien', 'QST-kuadrat', 'QST-trigonometri', 'QST-keliling'];
  const examQuestions: ExamQuestion[] = [];
  for (const exam of [demo, aljabar]) {
    ids.forEach((questionId, index) => {
      examQuestions.push({
        id: `EXQ-${exam.id}-${index + 1}`,
        examId: exam.id,
        questionId,
        urutan: index + 1,
        bobot: 1,
      });
    });
  }

  return { exams: [demo, aljabar], examQuestions };
}

interface SeedAttempt {
  id: string;
  studentId: string;
  skor: number;
  benar: number;
  salah: number;
  jawaban: [string, Answer['value'], boolean][];
}

function seedSubmissions(attempts: SeedAttempt[]): { submissions: MockSubmission[]; answers: Answer[] } {
  const exam = 'EXM-aljabar';
  const order = ['QST-eksponen', 'QST-gradien', 'QST-kuadrat', 'QST-trigonometri', 'QST-keliling'];
  const submissions: MockSubmission[] = [];
  const answers: Answer[] = [];

  for (const attempt of attempts) {
    const mulaiAt = iso(-5 * DAY + HOUR);
    const submitAt = iso(-5 * DAY + HOUR + 15 * 60_000);
    submissions.push({
      id: attempt.id,
      examId: exam,
      examName: 'Ulangan Harian Aljabar',
      studentId: attempt.studentId,
      studentName: '',
      studentNis: '',
      kelas: '',
      mulaiAt,
      expiresAt: iso(-5 * DAY + HOUR + 20 * 60_000),
      submitAt,
      status: 'graded',
      skor: attempt.skor,
      skorMaks: 100,
      benar: attempt.benar,
      salah: attempt.salah,
      kosong: 5 - attempt.benar - attempt.salah,      perluManual: 0,
      tabSwitchCount: 0,
      autoSubmitted: false,
      lastSeenAt: submitAt,
      durationSec: 15 * 60,
      questionOrder: order,
    });

    attempt.jawaban.forEach(([questionId, value, benar], index) => {
      answers.push({
        id: `ANS-${attempt.id}-${index + 1}`,
        submissionId: attempt.id,
        examId: exam,
        userId: attempt.studentId,
        questionId,
        value,
        ragu: false,
        benar,
        skor: benar ? 1 : 0,
        updatedAt: submitAt,
      });
    });
  }

  return { submissions, answers };
}

const ANSWER_BY_KEY: Record<string, Answer['value']> = {
  'QST-eksponen': { selected: ['C'] },
  'QST-gradien': { selected: ['B'] },
  'QST-kuadrat': { selected: ['B'] },
  'QST-trigonometri': { selected: ['B'] },
  'QST-keliling': { selected: ['C'] },
};

function correctAnswersFor(ids: string[]): [string, Answer['value'], boolean][] {
  return ids.map((id) => [id, ANSWER_BY_KEY[id] ?? null, true]);
}

export function createSeed(): MockDB {
  const now = iso();
  const users: MockUserRecord[] = [
    user('USR-admin', 'admin@cbt.local', 'Admin Sekolah', 'admin'),
    user('USR-guru', 'guru@cbt.local', 'Budi Santoso, S.Pd.', 'guru'),
    user('USR-siswa', 'siswa@cbt.local', 'Ani Lestari', 'siswa', {
      nis: '2024001',
      kelas: 'XII-IPA-1',
    }),
    user('USR-siswa2', 'siswa2@cbt.local', 'Bima Prakoso', 'siswa', {
      nis: '2024002',
      kelas: 'XII-IPA-1',
    }),
    user('USR-siswa3', 'siswa3@cbt.local', 'Citra Dewi', 'siswa', {
      nis: '2024003',
      kelas: 'XII-IPA-2',
    }),
  ];

  const { exams, examQuestions } = seedExams();
  const questions = seedQuestions();

  const wrongKuadrat = [...correctAnswersFor(['QST-eksponen', 'QST-gradien'])];
  wrongKuadrat.push(['QST-kuadrat', { selected: ['A'] }, false]);
  wrongKuadrat.push(...correctAnswersFor(['QST-trigonometri', 'QST-keliling']));

  const partial = correctAnswersFor(['QST-eksponen']);
  partial.push(['QST-gradien', { selected: ['D'] }, false]);
  partial.push(['QST-kuadrat', { selected: ['A'] }, false]);
  partial.push(['QST-trigonometri', { selected: ['B'] }, true]);
  partial.push(['QST-keliling', { selected: ['C'] }, true]);

  const { submissions, answers } = seedSubmissions([
    { id: 'SUB-demo-ani', studentId: 'USR-siswa', skor: 80, benar: 4, salah: 1, jawaban: wrongKuadrat },
    {
      id: 'SUB-demo-bima',
      studentId: 'USR-siswa2',
      skor: 100,
      benar: 5,
      salah: 0,
      jawaban: correctAnswersFor(['QST-eksponen', 'QST-gradien', 'QST-kuadrat', 'QST-trigonometri', 'QST-keliling']),
    },
    { id: 'SUB-demo-citra', studentId: 'USR-siswa3', skor: 60, benar: 3, salah: 2, jawaban: partial },
  ]);

  const logs: LogEntry[] = [
    {
      id: 'LOG-seed-1',
      ts: iso(-2 * HOUR),
      actorId: 'USR-guru',
      actorName: 'Budi Santoso, S.Pd.',
      action: 'exam.publish',
      entity: 'exam',
      entityId: 'EXM-demo',
      meta: { nama: 'Ujian Demo Matematika' },
    },
    {
      id: 'LOG-seed-2',
      ts: iso(-5 * DAY + HOUR),
      actorId: 'USR-siswa',
      actorName: 'Ani Lestari',
      action: 'exam.submit',
      entity: 'submission',
      entityId: 'SUB-demo-ani',
      meta: { skor: 80 },
    },
  ];

  return {
    version: 3,
    users: users.map((item) => ({ ...item, updatedAt: now })),
    questions,
    exams,
    examQuestions,
    submissions,
    answers,
    logs,
    settings: {
      schoolName: 'SMA Negeri 1 Contoh',
      schoolAddress: 'Jl. Pendidikan No. 1, Jakarta Selatan, DKI Jakarta 12345',
      schoolLogoUrl: '',
      schoolHeadmaster: 'Drs. Hendra Wijaya, M.Pd.',
    },
  };
}

export { DEMO_PASSWORD_NOTE };
