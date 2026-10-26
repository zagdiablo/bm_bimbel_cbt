import { describeKey } from '@/lib/constants';
import { useExamPreview } from '../queries';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { QuestionTypeBadge } from '@/features/questions/components/question-badges';
import { formatDateTime } from '@/lib/utils';

interface ExamPreviewDialogProps {
  examId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExamPreviewDialog({ examId, open, onOpenChange }: ExamPreviewDialogProps) {
  const preview = useExamPreview(open ? examId : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Pratinjau ujian</DialogTitle>
          <DialogDescription>
            Hanya guru/admin. Kunci jawaban akan disembunyikan otomatis dari siswa.
          </DialogDescription>
        </DialogHeader>

        {preview.isPending ? (
          <LoadingState label="Memuat soal ujian..." />
        ) : preview.isError ? (
          <ErrorState error={preview.error} onRetry={() => void preview.refetch()} />
        ) : preview.data ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="font-semibold">{preview.data.exam.nama}</p>
              <p className="text-xs text-muted-foreground">
                {preview.data.exam.mapel} • {preview.data.exam.durasiMenit} menit •{' '}
                {preview.data.exam.jumlahSoal} soal diambil •{' '}
                {formatDateTime(preview.data.exam.mulaiAt)}
              </p>
            </div>
            <ol className="space-y-4">
              {preview.data.questions.map((question, index) => (
                <li key={question.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">#{index + 1}</span>
                    <QuestionTypeBadge tipe={question.tipe} />
                    <Badge variant="outline">Bobot {question.bobot}</Badge>
                  </div>
                  <p className="prose-question mt-1.5 text-sm">{question.pertanyaan}</p>
                  {question.options.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-sm">
                      {question.options.map((option) => (
                        <li key={option.id} className="flex gap-2">
                          <span className="font-semibold">{option.id}.</span>
                          <span>{option.teks}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="mt-2 rounded bg-success/10 px-2 py-1 text-xs">
                    <span className="font-semibold text-success">Kunci:</span>{' '}
                    {describeKey(question.kunci, question.options)}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
