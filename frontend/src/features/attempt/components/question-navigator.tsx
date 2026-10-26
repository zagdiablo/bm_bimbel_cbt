import { Bookmark, CheckCircle2 } from 'lucide-react';
import type { AnswerValue, AttemptQuestion } from '@/types/domain';
import { cn, formatClock } from '@/lib/utils';
import { hasAnswer } from '@/lib/constants';
import { Button } from '@/components/ui/button';

interface QuestionNavigatorProps {
  questions: AttemptQuestion[];
  current: number;
  answers: Record<string, AnswerValue | null>;
  ragu: Record<string, boolean>;
  remaining: number;
  onSelect: (index: number) => void;
}

export function QuestionNavigator({
  questions,
  current,
  answers,
  ragu,
  remaining,
  onSelect,
}: QuestionNavigatorProps) {
  const answeredCount = questions.filter((question) => hasAnswer(answers[question.id] ?? null)).length;
  const raguCount = questions.filter((question) => ragu[question.id]).length;
  const unanswered = questions.length - answeredCount;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Navigasi soal</p>
          <span className="font-mono text-xs text-muted-foreground">{formatClock(remaining)}</span>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {questions.map((question, index) => {
            const answered = hasAnswer(answers[question.id] ?? null);
            const marked = Boolean(ragu[question.id]);
            const active = index === current;
            return (
              <button
                key={question.id}
                type="button"
                onClick={() => onSelect(index)}
                aria-label={`Soal ${index + 1}${answered ? ', sudah dijawab' : ', belum dijawab'}${marked ? ', ragu-ragu' : ''}`}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'relative flex h-9 w-full items-center justify-center rounded-md border text-xs font-semibold transition-colors',
                  answered
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background hover:bg-muted',
                  marked && 'ring-2 ring-warning ring-offset-1',
                  active && 'outline outline-2 outline-offset-2 outline-foreground',
                )}
              >
                {index + 1}
                {marked ? (
                  <Bookmark className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 fill-warning text-warning" />
                ) : null}
              </button>
            );
          })}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            <dt className="text-muted-foreground">Dijawab</dt>
            <dd className="ml-auto font-semibold tabular-nums">{answeredCount}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded-sm border border-input" />
            <dt className="text-muted-foreground">Kosong</dt>
            <dd className="ml-auto font-semibold tabular-nums">{unanswered}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Bookmark className="h-3.5 w-3.5 text-warning" />
            <dt className="text-muted-foreground">Ragu</dt>
            <dd className="ml-auto font-semibold tabular-nums">{raguCount}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded-sm bg-muted" />
            <dt className="text-muted-foreground">Total</dt>
            <dd className="ml-auto font-semibold tabular-nums">{questions.length}</dd>
          </div>
        </dl>
      </div>

      {unanswered > 0 ? (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            const index = questions.findIndex((question) => !hasAnswer(answers[question.id] ?? null));
            if (index >= 0) onSelect(index);
          }}
        >
          Ke soal kosong berikutnya
        </Button>
      ) : null}
    </div>
  );
}
