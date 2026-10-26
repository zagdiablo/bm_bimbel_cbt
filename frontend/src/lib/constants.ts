import type {
  AnswerValue,
  ExamFilters,
  QuestionFilters,
  QuestionKey,
  QuestionOption,
  QuestionType,
  Role,
} from '@/types/domain';

export const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'pg', label: 'Pilihan Ganda' },
  { value: 'pg_kompleks', label: 'Pilihan Ganda Kompleks' },
  { value: 'benar_salah', label: 'Benar / Salah' },
  { value: 'isian', label: 'Isian Singkat' },
  { value: 'essay', label: 'Essay' },
];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  guru: 'Guru',
  siswa: 'Siswa',
};

export const DIFFICULTY_LABELS = {
  mudah: 'Mudah',
  sedang: 'Sedang',
  sulit: 'Sulit',
} as const;

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  pg: 'Pilihan Ganda',
  pg_kompleks: 'PG Kompleks',
  benar_salah: 'Benar / Salah',
  isian: 'Isian Singkat',
  essay: 'Essay',
};

export const EXAM_STATUS_LABELS = {
  draft: 'Draft',
  published: 'Terbit',
  closed: 'Ditutup',
} as const;

export const SUBMISSION_STATUS_LABELS = {
  in_progress: 'Sedang Mengerjakan',
  submitted: 'Terkirim',
  needs_grading: 'Perlu Dinilai',
  graded: 'Selesai',
  expired: 'Waktu Habis',
} as const;

export const OPTION_IDS = ['A', 'B', 'C', 'D', 'E'] as const;

export const EMPTY_QUESTION_FILTERS: QuestionFilters = {
  q: '',
  kategori: '',
  tipe: '',
  tingkat: '',
  page: 1,
  pageSize: 20,
};

export const EMPTY_EXAM_FILTERS: ExamFilters = {
  q: '',
  status: '',
  page: 1,
  pageSize: 20,
};

/** Lightweight client-side type guards to keep rendering safe. */
export function isChoiceQuestion(tipe: QuestionType): boolean {
  return tipe === 'pg' || tipe === 'pg_kompleks';
}

export function isManuallyGraded(tipe: QuestionType): boolean {
  return tipe === 'essay';
}

export function hasAnswer(value: AnswerValue | null | undefined): boolean {
  if (!value) return false;
  if (Array.isArray(value.selected)) return value.selected.length > 0;
  if (typeof value.value === 'boolean') return true;
  if (typeof value.text === 'string') return value.text.trim().length > 0;
  return false;
}

/** Display helper for keys and answers, used in previews and result pages. */
export function describeKey(kunci: QuestionKey | undefined, options: QuestionOption[]): string {
  if (!kunci) return '—';
  if (kunci.selected?.length) {
    return kunci.selected
      .map((id) => {
        const opt = options.find((o) => o.id === id);
        return opt ? `${opt.id}. ${opt.teks}` : id;
      })
      .join('; ');
  }
  if (typeof kunci.value === 'boolean') return kunci.value ? 'Benar' : 'Salah';
  if (kunci.accepted?.length) return kunci.accepted.join(' | ');
  if (kunci.rubrik) return kunci.rubrik;
  return '—';
}

export function describeAnswer(
  value: AnswerValue | null | undefined,
  options: QuestionOption[],
): string {
  if (!value) return 'Tidak dijawab';
  if (value.selected?.length) {
    return value.selected
      .map((id) => {
        const opt = options.find((o) => o.id === id);
        return opt ? `${opt.id}. ${opt.teks}` : id;
      })
      .join('; ');
  }
  if (typeof value.value === 'boolean') return value.value ? 'Benar' : 'Salah';
  if (value.text?.trim()) return value.text;
  return 'Tidak dijawab';
}
