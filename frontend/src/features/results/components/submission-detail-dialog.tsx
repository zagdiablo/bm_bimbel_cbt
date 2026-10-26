import { useEffect, useState } from 'react';
import { CheckCircle2, Download, Loader2, MinusCircle, Send, XCircle } from 'lucide-react';
import type { Answer } from '@/types/domain';
import { describeAnswer, describeKey, hasAnswer } from '@/lib/constants';
import { exportStudentResultPdf } from '@/lib/export-pdf';
import { toastError, toastSuccess } from '@/lib/notify';
import { useGradeEssay, useForceSubmit, useSubmissionDetail } from '../queries';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { ScoreBadge, SubmissionStatusBadge } from '@/components/common/status-badges';
import { QuestionTypeBadge } from '@/features/questions/components/question-badges';
import { formatDateTime, formatDuration } from '@/lib/utils';

interface SubmissionDetailDialogProps {
  submissionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function EssayScore({
  answer,
  bobot,
  value,
  onChange,
}: {
  answer: Answer;
  bobot: number;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <label htmlFor={`score-${answer.id}`} className="text-xs text-muted-foreground">
          Skor (0–{bobot})
        </label>
        <Input
          id={`score-${answer.id}`}
          type="number"
          min={0}
          max={bobot}
          step="0.5"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-28"
        />
      </div>
      {answer.dinilaiAt ? (
        <p className="text-xs text-muted-foreground">Dinilai {formatDateTime(answer.dinilaiAt)}</p>
      ) : (
        <Badge variant="warning">Belum dinilai</Badge>
      )}
    </div>
  );
}

export function SubmissionDetailDialog({
  submissionId,
  open,
  onOpenChange,
}: SubmissionDetailDialogProps) {
  const detail = useSubmissionDetail(open ? submissionId : null);
  const grade = useGradeEssay();
  const forceSubmit = useForceSubmit();
  const [scores, setScores] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!detail.data) return;
    const initial: Record<string, string> = {};
    for (const row of detail.data.rows) {
      if (row.question.tipe === 'essay' && row.answer) {
        initial[row.answer.id] = row.answer.skor === null ? '' : String(row.answer.skor);
      }
    }
    setScores(initial);
  }, [detail.data]);

  const saveScores = () => {
    if (!detail.data) return;
    const items = detail.data.rows
      .filter((row) => row.question.tipe === 'essay' && row.answer)
      .map((row) => {
        const raw = scores[row.answer?.id ?? ''];
        if (raw === undefined || raw === '') return null;
        return { answerId: row.answer?.id ?? '', skor: Number(raw) };
      })
      .filter((item): item is { answerId: string; skor: number } => item !== null && Number.isFinite(item.skor));

    if (items.length === 0) {
      toastError(new Error('Isi minimal satu skor essay.'), 'Tidak ada nilai');
      return;
    }
    grade.mutate({ submissionId: detail.data.submission.id, items });
  };

  const handleExport = async () => {
    if (!detail.data) return;
    setExporting(true);
    try {
      await exportStudentResultPdf(detail.data);
      toastSuccess('PDF hasil siswa dibuat');
    } catch (error) {
      toastError(error, 'Gagal membuat PDF');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Detail pengerjaan</DialogTitle>
          <DialogDescription>
            Periksa jawaban siswa dan beri nilai untuk soal essay.
          </DialogDescription>
        </DialogHeader>

        {detail.isPending ? (
          <LoadingState label="Memuat jawaban siswa..." />
        ) : detail.isError ? (
          <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
        ) : detail.data ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-muted/50 p-3">
              <div>
                <p className="font-semibold">
                  {detail.data.submission.studentName}{' '}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({detail.data.submission.studentNis || '-'})
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {detail.data.submission.kelas ?? '-'} • {detail.data.exam.nama} •{' '}
                  {formatDateTime(detail.data.submission.submitAt)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Durasi {formatDuration(detail.data.submission.durationSec)} • Pelanggaran fokus:{' '}
                  {detail.data.submission.tabSwitchCount}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <SubmissionStatusBadge status={detail.data.submission.status} />
                <ScoreBadge score={detail.data.submission.skor} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void handleExport()} disabled={exporting}>
                {exporting ? <Loader2 className="animate-spin" /> : <Download />} PDF siswa
              </Button>
              {detail.data.submission.status === 'in_progress' ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => forceSubmit.mutate(detail.data?.submission.id ?? '')}
                  disabled={forceSubmit.isPending}
                >
                  <Send /> Kumpulkan paksa
                </Button>
              ) : null}
            </div>

            <div className="space-y-3">
              {detail.data.rows.map((row) => {
                const answer = row.answer;
                const benar = answer?.benar;
                return (
                  <div key={row.question.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold text-muted-foreground">#{row.nomor}</span>
                      <QuestionTypeBadge tipe={row.question.tipe} />
                      <Badge variant="outline">Bobot {row.bobot}</Badge>
                      {benar === true ? (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Benar
                        </Badge>
                      ) : benar === false ? (
                        <Badge variant="danger" className="gap-1">
                          <XCircle className="h-3 w-3" /> Salah
                        </Badge>
                      ) : hasAnswer(answer?.value ?? null) ? (
                        <Badge variant="warning">Perlu dinilai</Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <MinusCircle className="h-3 w-3" /> Kosong
                        </Badge>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">
                        Skor {answer?.skor ?? 0}/{row.bobot}
                      </span>
                    </div>

                    <p className="prose-question mt-1.5 text-sm">{row.question.pertanyaan}</p>

                    <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                      <div className="rounded bg-muted/40 p-2">
                        <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                          Jawaban siswa
                        </p>
                        <p className="whitespace-pre-wrap">
                          {describeAnswer(answer?.value ?? null, row.question.options)}
                        </p>
                      </div>
                      {detail.data?.canSeeKey ? (
                        <div className="rounded bg-success/5 p-2">
                          <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                            Kunci
                          </p>
                          <p>{describeKey(row.question.kunci, row.question.options)}</p>
                        </div>
                      ) : null}
                    </div>

                    {row.question.tipe === 'essay' && answer && hasAnswer(answer.value) ? (
                      <EssayScore
                        answer={answer}
                        bobot={row.bobot}
                        value={scores[answer.id] ?? ''}
                        onChange={(value) => setScores((current) => ({ ...current, [answer.id]: value }))}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Tutup
              </Button>
              <Button onClick={saveScores} disabled={grade.isPending}>
                {grade.isPending ? <Loader2 className="animate-spin" /> : null} Simpan nilai essay
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
