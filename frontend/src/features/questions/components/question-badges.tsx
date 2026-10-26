import type { Difficulty, QuestionType } from '@/types/domain';
import { Badge } from '@/components/ui/badge';
import { DIFFICULTY_LABELS, QUESTION_TYPE_LABELS } from '@/lib/constants';

const TYPE_VARIANT: Record<QuestionType, 'default' | 'info' | 'secondary' | 'outline' | 'warning'> = {
  pg: 'default',
  pg_kompleks: 'info',
  benar_salah: 'secondary',
  isian: 'outline',
  essay: 'warning',
};

export function QuestionTypeBadge({ tipe }: { tipe: QuestionType }) {
  return <Badge variant={TYPE_VARIANT[tipe]}>{QUESTION_TYPE_LABELS[tipe]}</Badge>;
}

const DIFFICULTY_VARIANT: Record<Difficulty, 'success' | 'warning' | 'danger'> = {
  mudah: 'success',
  sedang: 'warning',
  sulit: 'danger',
};

export function DifficultyBadge({ tingkat }: { tingkat: Difficulty }) {
  return <Badge variant={DIFFICULTY_VARIANT[tingkat]}>{DIFFICULTY_LABELS[tingkat]}</Badge>;
}
