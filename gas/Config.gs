/**
 * CBT Backend — Google Apps Script
 *
 * Shared configuration, sheet schema, and small helpers.
 * Deploy as Web App (Execute as: Me, Who has access: Anyone).
 */

var CONFIG = {
  VERSION: '1.0.0',
  TIMEZONE: 'Asia/Jakarta',
  ACCESS_TOKEN_TTL_SECONDS: 2 * 60 * 60, // 2 hours
  REFRESH_TOKEN_TTL_SECONDS: 7 * 24 * 60 * 60, // 7 days
  LOCK_TIMEOUT_MS: 10000,
  KKM: 75,
  AUTO_SUBMIT_ON_CHEAT: false,
  MAX_PAGE_SIZE: 100,
  SHEETS: {
    Users: [
      'id',
      'email',
      'name',
      'role',
      'nis',
      'kelas',
      'passwordHash',
      'googleSub',
      'avatarUrl',
      'active',
      'tokenVersion',
      'createdAt',
      'updatedAt',
    ],
    Questions: [
      'id',
      'ownerId',
      'tipe',
      'pertanyaan',
      'gambarUrl',
      'opsiJson',
      'kunciJson',
      'pembahasan',
      'bobot',
      'tingkat',
      'kategori',
      'tags',
      'aktif',
      'createdAt',
      'updatedAt',
    ],
    Exams: [
      'id',
      'ownerId',
      'nama',
      'mapel',
      'deskripsi',
      'durasiMenit',
      'mulaiAt',
      'selesaiAt',
      'jumlahSoal',
      'acakSoal',
      'acakOpsi',
      'tampilkanPembahasan',
      'tampilkanNilai',
      'token',
      'kelasTargetJson',
      'status',
      'createdAt',
      'updatedAt',
    ],
    ExamQuestions: ['id', 'examId', 'questionId', 'urutan', 'bobot'],
    Submissions: [
      'id',
      'examId',
      'studentId',
      'mulaiAt',
      'expiresAt',
      'submitAt',
      'status',
      'skor',
      'skorMaks',
      'benar',
      'salah',
      'kosong',
      'perluManual',
      'tabSwitchCount',
      'autoSubmitted',
      'lastSeenAt',
      'questionOrderJson',
      'durationSec',
      'userAgent',
    ],
    Answers: [
      'id',
      'examId',
      'userId',
      'submissionId',
      'questionId',
      'jawabanJson',
      'ragu',
      'benar',
      'skor',
      'dinilaiOleh',
      'dinilaiAt',
      'updatedAt',
    ],
    Logs: ['id', 'ts', 'actorId', 'actorName', 'action', 'entity', 'entityId', 'metaJson'],
  },
};

var SHEET_NAMES = ['Users', 'Questions', 'Exams', 'ExamQuestions', 'Submissions', 'Answers', 'Logs'];

var ROLES = ['admin', 'guru', 'siswa'];
var QUESTION_TYPES = ['pg', 'pg_kompleks', 'benar_salah', 'isian', 'essay'];
var DIFFICULTIES = ['mudah', 'sedang', 'sulit'];

class AppError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details || null;
  }
}

function fail_(code, message, details) {
  throw new AppError(code, message, details);
}

function nowIso_() {
  return new Date().toISOString();
}

function newId_(prefix) {
  return prefix + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 12);
}

/** Local date key in Asia/Jakarta, used by dashboard charts. */
function dayKey_(date) {
  return Utilities.formatDate(date, CONFIG.TIMEZONE, 'yyyy-MM-dd');
}

function getProp_(key, fallback) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  return value === null || value === '' ? fallback : value;
}

function setProp_(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, String(value));
}

function tokenSecret_() {
  const existing = getProp_('TOKEN_SECRET', '');
  if (existing) return existing;
  const secret = Utilities.getUuid() + Utilities.getUuid();
  setProp_('TOKEN_SECRET', secret);
  return secret;
}

/**
 * Separate pepper for password hashes. Keeping it apart from TOKEN_SECRET means
 * rotating the token secret only invalidates sessions, not every password.
 */
function passwordPepper_() {
  const existing = getProp_('PASSWORD_PEPPER', '');
  if (existing) return existing;
  const pepper = Utilities.getUuid() + Utilities.getUuid();
  setProp_('PASSWORD_PEPPER', pepper);
  return pepper;
}

function toNumber_(value, fallback) {
  const number = Number(value);
  return isFinite(number) ? number : fallback || 0;
}

function toBool_(value) {
  return value === true || value === 'true' || value === 'TRUE' || value === 1 || value === '1';
}

function toIso_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') return value.toISOString();
  const date = new Date(value);
  return isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function parseJson_(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch (error) {
    return fallback;
  }
}

function toJson_(value) {
  return JSON.stringify(value === undefined ? null : value);
}

function trim_(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}

function paginate_(items, page, pageSize) {
  const size = Math.min(CONFIG.MAX_PAGE_SIZE, Math.max(1, Math.round(toNumber_(pageSize, 20))));
  const current = Math.max(1, Math.round(toNumber_(page, 1)));
  const start = (current - 1) * size;
  return {
    items: items.slice(start, start + size),
    total: items.length,
    page: current,
    pageSize: size,
    hasMore: start + size < items.length,
  };
}

function schoolSettings_() {
  return {
    schoolName: getProp_('SCHOOL_NAME', 'SMA Negeri 1 Contoh'),
    schoolAddress: getProp_('SCHOOL_ADDRESS', 'Jl. Pendidikan No. 1, Jakarta'),
    schoolLogoUrl: getProp_('SCHOOL_LOGO_URL', ''),
    schoolHeadmaster: getProp_('SCHOOL_HEADMASTER', ''),
  };
}
