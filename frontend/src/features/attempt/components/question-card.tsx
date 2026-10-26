import { useMemo } from 'react';
import { Bookmark, BookmarkCheck, Check } from 'lucide-react';
import type { AnswerValue, AttemptQuestion } from '@/types/domain';
import { cn } from '@/lib/utils';
import { seededShuffle } from '@/lib/shuffle';
import { QUESTION_TYPE_LABELS } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface QuestionCardProps {
  question: AttemptQuestion;
  value: AnswerValue | null | undefined;
  ragu: boolean;
  onAnswer: (value: AnswerValue | null) => void;
  onToggleRagu: () => void;
  index: number;
  total: number;
  shuffleSeed: string;
  shuffleOptions: boolean;
}

export function QuestionCard({
  question,
  value,
  ragu,
  onAnswer,
  onToggleRagu,
  index,
  total,
  shuffleSeed,
  shuffleOptions,
}: QuestionCardProps) {
  const options = useMemo(
    () =>
      shuffleOptions
        ? seededShuffle(question.options, `${shuffleSeed}:${question.id}`)
        : question.options,
    [question.options, question.id, shuffleSeed, shuffleOptions],
  );

  const selected = value?.selected ?? [];
  const isChoice = question.tipe === 'pg' || question.tipe === 'pg_kompleks';

  const toggleOption = (id: string) => {
    if (question.tipe === 'pg') {
      onAnswer({ selected: [id] });
      return;
    }
    const next = selected.includes(id)
      ? selected.filter((item) => item !== id)
      : [...selected, id];
    onAnswer(next.length > 0 ? { selected: next } : null);
  };

  return (
    <article className="rounded-xl border bg-card shadow-sm" aria-labelledby={`question-${question.id}`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default" className="tabular-nums">
            Soal {index + 1} / {total}
          </Badge>
          <Badge variant="outline">{QUESTION_TYPE_LABELS[question.tipe]}</Badge>
          <span className="text-xs text-muted-foreground">Bobot {question.bobot}</span>
        </div>
        <Button
          type="button"
          variant={ragu ? 'warning' : 'ghost'}
          size="sm"
          onClick={onToggleRagu}
          aria-pressed={ragu}
          className={ragu ? 'text-warning-foreground' : 'text-muted-foreground'}
        >
          {ragu ? <BookmarkCheck /> : <Bookmark />}
          {ragu ? 'Ditandai ragu' : 'Tandai ragu'}
        </Button>
      </header>

      <div className="space-y-4 p-4 sm:p-5">
        <p id={`question-${question.id}`} className="prose-question text-base">
          {question.pertanyaan}
        </p>

        {question.gambarUrl ? (
          <img
            src={question.gambarUrl}
            alt="Ilustrasi soal"
            className="max-h-72 w-full rounded-lg border object-contain"
          />
        ) : null}

        {isChoice ? (
          <fieldset>
            <legend className="sr-only">Pilih jawaban</legend>
            <div className="space-y-2">
              {options.map((option) => {
                const checked = selected.includes(option.id);
                return (
                  <label
                    key={option.id}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                      checked ? 'border-primary bg-accent/60' : 'hover:bg-muted/50',
                    )}
                  >
                    <input
                      type={question.tipe === 'pg' ? 'radio' : 'checkbox'}
                      name={`question-${question.id}`}
                      value={option.id}
                      checked={checked}
                      onChange={() => toggleOption(option.id)}
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                        checked
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted-foreground/30 text-muted-foreground',
                      )}
                      aria-hidden
                    >
                      {checked ? <Check className="h-3.5 w-3.5" /> : option.id}
                    </span>
                    <span className="min-w-0 flex-1 text-sm sm:text-base">{option.teks}</span>
                  </label>
                );
              })}
            </div>
            {question.tipe === 'pg_kompleks' ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Pilih semua jawaban yang benar. Skor penuh hanya jika seluruh pilihan tepat.
              </p>
            ) : null}
          </fieldset>
        ) : null}

        {question.tipe === 'benar_salah' ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {[true, false].map((option) => {
              const checked = value?.value === option;
              return (
                <button
                  key={String(option)}
                  type="button"
                  onClick={() => onAnswer({ value: option })}
                  aria-pressed={checked}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-lg border px-4 py-4 text-sm font-medium transition-colors',
                    checked ? 'border-primary bg-accent text-accent-foreground' : 'hover:bg-muted/50',
                  )}
                >
                  {checked ? <Check className="h-4 w-4" /> : null}
                  {option ? 'Benar' : 'Salah'}
                </button>
              );
            })}
          </div>
        ) : null}

        {question.tipe === 'isian' ? (
          <div className="space-y-1.5">
            <label htmlFor={`answer-${question.id}`} className="text-sm font-medium">
              Jawaban singkat
            </label>
            <Input
              id={`answer-${question.id}`}
              value={value?.text ?? ''}
              onChange={(event) => onAnswer(event.target.value ? { text: event.target.value } : null)}
              placeholder="Ketik jawaban Anda..."
              autoComplete="off"
              className="text-base"
            />
            <p className="text-xs text-muted-foreground">
              Tidak membedakan huruf besar/kecil. Periksa ejaan sebelum mengumpulkan.
            </p>
          </div>
        ) : null}

        {question.tipe === 'essay' ? (
          <div className="space-y-1.5">
            <label htmlFor={`answer-${question.id}`} className="text-sm font-medium">
              Jawaban uraian
            </label>
            <Textarea
              id={`answer-${question.id}`}
              rows={9}
              value={value?.text ?? ''}
              onChange={(event) => onAnswer(event.target.value ? { text: event.target.value } : null)}
              placeholder="Tulis jawaban lengkap Anda di sini..."
              className="text-base leading-relaxed"
            />
            <p className="text-right text-xs text-muted-foreground">
              {(value?.text ?? '').length} karakter
            </p>
          </div>
        ) : null}
      </div>
    </article>
  );
}
