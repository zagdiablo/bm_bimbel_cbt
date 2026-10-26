import { Check, ImageIcon } from 'lucide-react';
import type { Question } from '@/types/domain';
import { describeKey, hasAnswer } from '@/lib/constants';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { DifficultyBadge, QuestionTypeBadge } from './question-badges';

interface QuestionPreviewDialogProps {
  question: Question | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuestionPreviewDialog({ question, open, onOpenChange }: QuestionPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pratinjau soal</DialogTitle>
          <DialogDescription>
            Tampilan ini hanya untuk guru/admin karena menampilkan kunci jawaban.
          </DialogDescription>
        </DialogHeader>

        {question ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <QuestionTypeBadge tipe={question.tipe} />
              <DifficultyBadge tingkat={question.tingkat} />
              <Badge variant="outline">{question.kategori}</Badge>
              <Badge variant="secondary">Bobot {question.bobot}</Badge>
              {!question.aktif ? <Badge variant="danger">Nonaktif</Badge> : null}
            </div>

            <p className="prose-question text-sm sm:text-base">{question.pertanyaan}</p>

            {question.gambarUrl ? (
              <div className="overflow-hidden rounded-lg border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={question.gambarUrl} alt="Gambar soal" className="max-h-64 w-full object-contain" />
              </div>
            ) : (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <ImageIcon className="h-3.5 w-3.5" /> Tidak ada gambar
              </p>
            )}

            {question.tipe === 'pg' || question.tipe === 'pg_kompleks' ? (
              <ul className="space-y-2">
                {question.options.map((option) => {
                  const isKey = question.kunci?.selected?.includes(option.id) ?? false;
                  return (
                    <li
                      key={option.id}
                      className={
                        isKey
                          ? 'flex items-start gap-2 rounded-lg border border-success/40 bg-success/5 p-2.5'
                          : 'flex items-start gap-2 rounded-lg border p-2.5'
                      }
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-semibold">
                        {option.id}
                      </span>
                      <span className="flex-1 text-sm">{option.teks}</span>
                      {isKey ? (
                        <Badge variant="success" className="shrink-0 gap-1">
                          <Check className="h-3 w-3" /> Kunci
                        </Badge>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {question.tipe === 'benar_salah' ? (
              <div className="rounded-lg border p-3 text-sm">
                <span className="text-muted-foreground">Kunci: </span>
                <strong>{question.kunci?.value ? 'Benar' : 'Salah'}</strong>
              </div>
            ) : null}

            {question.tipe === 'isian' ? (
              <div className="rounded-lg border p-3 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Jawaban diterima
                </p>
                <p className="mt-1">{question.kunci?.accepted?.join(' | ') ?? '—'}</p>
              </div>
            ) : null}

            {question.tipe === 'essay' ? (
              <div className="rounded-lg border p-3 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rubrik</p>
                <p className="mt-1 whitespace-pre-wrap">{question.kunci?.rubrik || 'Tidak ada rubrik.'}</p>
              </div>
            ) : null}

            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Kunci ringkas
              </p>
              <p className="mt-1">
                {hasAnswer(question.kunci)
                  ? describeKey(question.kunci, question.options)
                  : 'Belum ada kunci.'}
              </p>
            </div>

            {question.pembahasan ? (
              <div className="rounded-lg border-l-4 border-primary bg-accent/40 p-3 text-sm">
                <p className="text-xs font-semibold text-primary">Pembahasan</p>
                <p className="mt-1 whitespace-pre-wrap">{question.pembahasan}</p>
              </div>
            ) : null}

            {question.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {question.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px]">
                    #{tag}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
