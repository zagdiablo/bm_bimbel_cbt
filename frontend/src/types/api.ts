import type {
  AnswerValue,
  DashboardStats,
  Difficulty,
  Exam,
  ExamFilters,
  ExamStats,
  LogEntry,
  Question,
  QuestionFilters,
  QuestionKey,
  QuestionOption,
  QuestionType,
  ResultDetail,
  Role,
  SaveAttemptResult,
  SchoolSettings,
  Submission,
  SubmissionStatus,
  User,
} from './domain';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: ApiErrorBody;
  serverTime?: string;
}

export interface LoginInput {
  email: string;
  credential: string;
}

export interface UserInput {
  name: string;
  email: string;
  role: Role;
  nis?: string;
  kelas?: string;
  active: boolean;
  credential?: string;
  avatarUrl?: string;
}

export interface QuestionInput {
  tipe: QuestionType;
  pertanyaan: string;
  gambarUrl?: string;
  options: QuestionOption[];
  kunci: QuestionKey;
  pembahasan?: string;
  bobot: number;
  tingkat: Difficulty;
  kategori: string;
  tags: string[];
  aktif: boolean;
}

export interface ExamInput {
  nama: string;
  mapel: string;
  deskripsi: string;
  durasiMenit: number;
  mulaiAt: string;
  selesaiAt: string;
  jumlahSoal: number;
  acakSoal: boolean;
  acakOpsi: boolean;
  tampilkanPembahasan: boolean;
  tampilkanNilai: boolean;
  token?: string;
  kelasTarget: string[];
}

export interface AnswerInput {
  questionId: string;
  value: AnswerValue | null;
  ragu: boolean;
}

export interface GradeItem {
  answerId: string;
  skor: number;
  catatan?: string;
}

export interface ExportRow {
  no: number;
  nis: string;
  nama: string;
  kelas: string;
  skor: number;
  status: SubmissionStatus;
  benar: number;
  salah: number;
  kosong: number;
  submitAt: string;
  durasi: string;
}

export interface ExportPayload {
  exam: Exam;
  school: SchoolSettings;
  rows: ExportRow[];
  stats: ExamStats;
  generatedAt: string;
}

export interface PagedQuery {
  page?: number;
  pageSize?: number;
}

export type { AnswerValue, DashboardStats, Exam, ExamFilters, ExamStats, LogEntry, Question, QuestionFilters, ResultDetail, Role, SaveAttemptResult, SchoolSettings, Submission, User };
