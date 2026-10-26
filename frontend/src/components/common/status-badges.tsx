import type { ExamStatus, Role, SubmissionStatus } from '@/types/domain';
import { Badge } from '@/components/ui/badge';
import {
  EXAM_STATUS_LABELS,
  ROLE_LABELS,
  SUBMISSION_STATUS_LABELS,
} from '@/lib/constants';
import { cn, formatNumber, scoreTone } from '@/lib/utils';

const ROLE_VARIANTS: Record<Role, 'default' | 'info' | 'secondary'> = {
  admin: 'default',
  guru: 'info',
  siswa: 'secondary',
};

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  return (
    <Badge variant={ROLE_VARIANTS[role]} className={className}>
      {ROLE_LABELS[role]}
    </Badge>
  );
}

const EXAM_VARIANTS: Record<ExamStatus, 'secondary' | 'success' | 'outline'> = {
  draft: 'secondary',
  published: 'success',
  closed: 'outline',
};

export function ExamStatusBadge({ status, className }: { status: ExamStatus; className?: string }) {
  return (
    <Badge variant={EXAM_VARIANTS[status]} className={className}>
      {EXAM_STATUS_LABELS[status]}
    </Badge>
  );
}

const SUBMISSION_VARIANTS: Record<
  SubmissionStatus,
  'secondary' | 'success' | 'warning' | 'outline' | 'danger' | 'info'
> = {
  in_progress: 'warning',
  submitted: 'info',
  needs_grading: 'warning',
  graded: 'success',
  expired: 'outline',
};

export function SubmissionStatusBadge({
  status,
  className,
}: {
  status: SubmissionStatus;
  className?: string;
}) {
  return (
    <Badge variant={SUBMISSION_VARIANTS[status]} className={className}>
      {SUBMISSION_STATUS_LABELS[status]}
    </Badge>
  );
}

export function ScoreBadge({ score, className }: { score: number; className?: string }) {
  const tone = scoreTone(score);
  return (
    <Badge
      variant={tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : 'danger'}
      className={cn('tabular-nums', className)}
    >
      {formatNumber(score, 2)}
    </Badge>
  );
}
