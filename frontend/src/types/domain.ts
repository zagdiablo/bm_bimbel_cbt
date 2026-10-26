/** Domain types shared by the UI, mock backend, and the GAS API contract. */

export type Role = 'admin' | 'guru' | 'siswa';

export type QuestionType = 'pg' | 'pg_kompleks' | 'benar_salah' | 'isian' | 'essay';

export type Difficulty = 'mudah' | 'sedang' | 'sulit';

export type ExamStatus = 'draft' | 'published' | 'closed';

export type SubmissionStatus =
  | 'in_progress'
  | 'submitted'
  | 'needs_grading'
  | 'graded'
  | 'expired';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  nis?: string;
  kelas?: string;
  avatarUrl?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionOption {
  id: string;
  teks: string;
}

/** Answer key shape depends on question type (see docs/IMPORT_FORMAT.md). */
export interface QuestionKey {
  selected?: string[];
  value?: boolean;
  accepted?: string[];
  rubrik?: string;
}

export interface AnswerValue {
  selected?: string[];
  value?: boolean;
  text?: string;
}

export interface Question {
  id: string;
  ownerId: string;
  ownerName?: string;
  tipe: QuestionType;
  pertanyaan: string;
  gambarUrl?: string;
  options: QuestionOption[];
  /** Present only for teacher/admin payloads. Never sent during an active attempt. */
  kunci?: QuestionKey;
  pembahasan?: string;
  bobot: number;
  tingkat: Difficulty;
  kategori: string;
  tags: string[];
  aktif: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Exam {
  id: string;
  ownerId: string;
  ownerName?: string;
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
  status: ExamStatus;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
  /** Student-only: state of the current student's attempt, if any. */
  attemptStatus?: SubmissionStatus | null;
  submissionId?: string | null;
  /** Student-only: whether the exam requires a token (the token itself is never sent). */
  requiresToken?: boolean;
}

export interface ExamQuestion {
  id: string;
  examId: string;
  questionId: string;
  urutan: number;
  bobot: number;
}

export interface Submission {
  id: string;
  examId: string;
  examName?: string;
  studentId: string;
  studentName?: string;
  studentNis?: string;
  kelas?: string;
  mulaiAt: string;
  expiresAt: string;
  submitAt?: string;
  status: SubmissionStatus;
  skor: number;
  skorMaks: number;
  benar: number;
  salah: number;
  kosong: number;
  perluManual: number;
  tabSwitchCount: number;
  autoSubmitted: boolean;
  lastSeenAt: string;
  durationSec?: number;
}

export interface Answer {
  id: string;
  submissionId: string;
  examId: string;
  userId: string;
  questionId: string;
  value: AnswerValue | null;
  ragu: boolean;
  benar: boolean | null;
  skor: number | null;
  dinilaiOleh?: string;
  dinilaiAt?: string;
  updatedAt: string;
}

export interface AttemptQuestion {
  id: string;
  tipe: QuestionType;
  pertanyaan: string;
  gambarUrl?: string;
  options: QuestionOption[];
  bobot: number;
  urutan: number;
}

export interface AttemptPayload {
  submission: Submission;
  exam: {
    id: string;
    nama: string;
    mapel: string;
    durasiMenit: number;
    acakOpsi: boolean;
    tampilkanPembahasan: boolean;
    tampilkanNilai: boolean;
  };
  questions: AttemptQuestion[];
  answers: Answer[];
  remainingSec: number;
  serverTime: string;
}

export interface SaveAttemptResult {
  saved: string[];
  remainingSec: number;
  serverTime: string;
  status: SubmissionStatus;
  tabSwitchCount: number;
}

export interface ResultRow {
  nomor: number;
  question: Question;
  answer: Answer | null;
  bobot: number;
  skorMaks: number;
}

export interface ResultDetail {
  submission: Submission;
  exam: Exam;
  rows: ResultRow[];
  canSeeKey: boolean;
  school?: SchoolSettings;
}

export interface SchoolSettings {
  schoolName: string;
  schoolAddress: string;
  schoolLogoUrl: string;
  schoolHeadmaster: string;
}

export interface ExamStats {
  count: number;
  avg: number;
  min: number;
  max: number;
  passed: number;
  distribution: { label: string; value: number }[];
  perQuestion: {
    questionId: string;
    nomor: number;
    pertanyaan: string;
    benar: number;
    salah: number;
    kosong: number;
  }[];
}

export interface LogEntry {
  id: string;
  ts: string;
  actorId?: string;
  actorName?: string;
  action: string;
  entity?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}

export type StatIcon = 'users' | 'exams' | 'questions' | 'submissions' | 'score' | 'clock';

export interface DashboardStats {
  cards: { label: string; value: string; hint?: string; icon: StatIcon }[];
  chart: { label: string; value: number }[];
  upcomingExams: Exam[];
  recentSubmissions: Submission[];
  pendingGrading: Submission[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface QuestionFilters {
  q?: string;
  kategori?: string;
  tipe?: QuestionType | '';
  tingkat?: Difficulty | '';
  page?: number;
  pageSize?: number;
}

export interface ExamFilters {
  q?: string;
  status?: ExamStatus | '';
  page?: number;
  pageSize?: number;
}
