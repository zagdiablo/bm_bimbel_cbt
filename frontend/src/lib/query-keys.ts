import type { ExamFilters, QuestionFilters, SubmissionStatus } from '@/types/domain';
import type { SubmissionFilters, UserFilters } from '@/lib/api';

export const qk = {
  health: ['health'] as const,
  users: (filters: UserFilters) => ['users', filters] as const,
  questions: (filters: QuestionFilters) => ['questions', filters] as const,
  questionMeta: ['questions', 'meta'] as const,
  exams: (filters: ExamFilters) => ['exams', filters] as const,
  exam: (id: string) => ['exam', id] as const,
  examPreview: (id: string) => ['exam', id, 'preview'] as const,
  examInfo: (id: string) => ['exam', id, 'info'] as const,
  attempt: (id: string) => ['attempt', id] as const,
  submissions: (filters: SubmissionFilters & { status?: SubmissionStatus | '' }) =>
    ['submissions', filters] as const,
  submission: (id: string) => ['submission', id] as const,
  resultsMine: ['results', 'mine'] as const,
  resultDetail: (id: string) => ['results', 'detail', id] as const,
  examResults: (examId: string) => ['results', 'exam', examId] as const,
  stats: (examId: string) => ['stats', examId] as const,
  exportData: (examId: string) => ['export', examId] as const,
  dashboard: ['dashboard'] as const,
  settings: ['settings'] as const,
  logs: (page: number) => ['logs', page] as const,
};
