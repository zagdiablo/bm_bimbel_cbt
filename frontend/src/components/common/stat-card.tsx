import type { LucideIcon } from 'lucide-react';
import { BookOpen, ClipboardList, Clock, FileQuestion, Gauge, Users } from 'lucide-react';
import type { StatIcon } from '@/types/domain';
import { cn } from '@/lib/utils';

const ICONS: Record<StatIcon, LucideIcon> = {
  users: Users,
  exams: ClipboardList,
  questions: FileQuestion,
  submissions: BookOpen,
  score: Gauge,
  clock: Clock,
};

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: StatIcon;
  className?: string;
}

export function StatCard({ label, value, hint, icon, className }: StatCardProps) {
  const Icon = ICONS[icon];
  return (
    <div className={cn('rounded-xl border bg-card p-4 shadow-sm', className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
