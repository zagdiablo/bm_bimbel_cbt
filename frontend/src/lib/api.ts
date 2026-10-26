import { request } from './api-client';
import type {
  AnswerInput,
  AuthSession,
  ExamInput,
  ExportPayload,
  GradeItem,
  LoginInput,
  PagedQuery,
  QuestionInput,
  UserInput,
} from '@/types/api';
import type {
  AttemptPayload,
  DashboardStats,
  Exam,
  ExamFilters,
  ExamStats,
  LogEntry,
  Paginated,
  Question,
  QuestionFilters,
  ResultDetail,
  Role,
  SaveAttemptResult,
  SchoolSettings,
  Submission,
  SubmissionStatus,
  User,
} from '@/types/domain';

export interface UserFilters extends PagedQuery {
  q?: string;
  role?: Role | '';
}

export interface SubmissionFilters extends PagedQuery {
  examId?: string;
  status?: SubmissionStatus | '';
}

export interface ExamDetail {
  exam: Exam;
  questions: Question[];
}

export type ExamInfo = Exam;

export const api = {
  auth: {
    login: (input: LoginInput) =>
      request<AuthSession>('auth.login', { ...input }, { publicAction: true }),
    google: (idToken: string) =>
      request<AuthSession>('auth.google', { idToken }, { publicAction: true }),
    refresh: (refreshToken: string) =>
      request<AuthSession>('auth.refresh', { refreshToken }, { publicAction: true }),
    me: () => request<{ user: User }>('auth.me'),
    logout: () => request<{ ok: true }>('auth.logout'),
    changePassword: (currentCredential: string, newCredential: string) =>
      request<{ ok: true }>('auth.changePassword', { currentCredential, newCredential }),
    updateProfile: (input: { name: string; avatarUrl?: string }) =>
      request<{ user: User }>('auth.updateProfile', input),
  },
  users: {
    list: (filters: UserFilters) => request<Paginated<User>>('users.list', { filters }),
    create: (input: UserInput) => request<{ user: User }>('users.create', { input }),
    update: (id: string, input: Partial<UserInput>) =>
      request<{ user: User }>('users.update', { id, input }),
    remove: (id: string) => request<{ ok: true }>('users.delete', { id }),
    resetPassword: (id: string, credential: string) =>
      request<{ ok: true }>('users.resetPassword', { id, credential }),
  },
  questions: {
    list: (filters: QuestionFilters) =>
      request<Paginated<Question>>('questions.list', { filters }),
    get: (id: string) => request<{ question: Question }>('questions.get', { id }),
    create: (input: QuestionInput) => request<{ question: Question }>('questions.create', { input }),
    update: (id: string, input: QuestionInput) =>
      request<{ question: Question }>('questions.update', { id, input }),
    remove: (id: string) => request<{ ok: true }>('questions.delete', { id }),
    bulkCreate: (items: QuestionInput[]) =>
      request<{ created: number; errors: { index: number; message: string }[] }>(
        'questions.bulkCreate',
        { items },
        { noRetry: true },
      ),
    meta: () => request<{ kategori: string[]; tags: string[] }>('questions.meta'),
  },
  exams: {
    list: (filters: ExamFilters) => request<Paginated<Exam>>('exams.list', { filters }),
    get: (id: string) => request<ExamDetail>('exams.get', { id }),
    create: (input: ExamInput) => request<{ exam: Exam }>('exams.create', { input }),
    update: (id: string, input: ExamInput) => request<{ exam: Exam }>('exams.update', { id, input }),
    remove: (id: string) => request<{ ok: true }>('exams.delete', { id }),
    setQuestions: (examId: string, questionIds: string[]) =>
      request<{ count: number }>('exams.setQuestions', { examId, questionIds }),
    preview: (id: string) => request<ExamDetail>('exams.preview', { id }),
    publish: (id: string) => request<{ exam: Exam }>('exams.publish', { id }),
    close: (id: string) => request<{ exam: Exam }>('exams.close', { id }),
    assign: (id: string, kelas: string[]) => request<{ exam: Exam }>('exams.assign', { id, kelas }),
    info: (id: string) => request<{ exam: Exam }>('exams.info', { id }),
  },
  attempts: {
    start: (examId: string, examToken?: string) =>
      request<AttemptPayload>('attempts.start', { examId, examToken }, { noRetry: true }),
    get: (submissionId: string) =>
      request<AttemptPayload>('attempts.get', { submissionId }),
    save: (submissionId: string, answers: AnswerInput[]) =>
      request<SaveAttemptResult>('attempts.save', { submissionId, answers }),
    logEvent: (submissionId: string, event: string) =>
      request<{ tabSwitchCount: number }>('attempts.logEvent', { submissionId, event }),
    submit: (submissionId: string) =>
      request<{ submission: Submission }>('attempts.submit', { submissionId }, { noRetry: true }),
  },
  submissions: {
    list: (filters: SubmissionFilters) =>
      request<Paginated<Submission>>('submissions.list', { filters }),
    get: (submissionId: string) =>
      request<ResultDetail>('submissions.get', { submissionId }),
    gradeEssay: (submissionId: string, items: GradeItem[]) =>
      request<{ submission: Submission }>('submissions.gradeEssay', { submissionId, items }),
    forceSubmit: (submissionId: string) =>
      request<{ submission: Submission }>('submissions.forceSubmit', { submissionId }),
  },
  results: {
    mine: () => request<{ items: Submission[] }>('results.mine'),
    detail: (submissionId: string) =>
      request<ResultDetail>('results.detail', { submissionId }),
    list: (examId: string) => request<{ items: Submission[] }>('results.list', { examId }),
    exportData: (examId: string) => request<ExportPayload>('results.exportData', { examId }),
    stats: (examId: string) => request<ExamStats>('results.stats', { examId }),
  },
  dashboard: {
    stats: () => request<DashboardStats>('dashboard.stats'),
  },
  settings: {
    get: () => request<{ settings: SchoolSettings; appName: string }>('settings.get'),
    update: (settings: SchoolSettings) =>
      request<{ settings: SchoolSettings }>('settings.update', { settings }),
  },
  logs: {
    list: (query: PagedQuery) => request<Paginated<LogEntry>>('logs.list', { ...query }),
  },
};

export type { SchoolSettings };
