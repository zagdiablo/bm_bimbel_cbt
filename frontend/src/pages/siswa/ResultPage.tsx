import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Info,
  Loader2,
  MinusCircle,
  XCircle,
} from 'lucide-react';
import type { Answer } from '@/types/domain';
import { describeAnswer, describeKey, hasAnswer } from '@/lib/constants';
import { exportStudentResultPdf } from '@/lib/export-pdf';
import { toastError, toastSuccess } from '@/lib/notify';
import { cn, formatDateTime, formatDuration, formatNumber } from '@/lib/utils';
import { useResultDetail } from '@/features/results/queries';
import { PageHeader } from '@/components/common/page-header';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { SubmissionStatusBadge } from '@/components/common/status-badges';
import { QuestionTypeBadge } from '@/features/questions/components/question-badges';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDocumentTitle } from '@/hooks/use-document-title';

function verdict(answer: Answer | null) {
  if (!answer || !hasAnswer(answer.value)) {
    return { icon: MinusCircle, label: 'Kosong', className: 'text-muted-foreground', variant: 'outline' as const };
  }
  if (answer.benar === true) {
    return { icon: CheckCircle2, label: 'Benar', className: 'text-success', variant: 'success' as const };
  }
  if (answer.benar === false) {
    return { icon: XCircle, label: 'Salah', className: 'text-destructive', variant: 'danger' as const };
  }
  return {
    icon: Info,
    label: 'Menunggu penilaian',
    className: 'text-warning',
    variant: 'warning' as const,
  };
}

export function ResultPage() {
  useDocumentTitle('Hasil Ujian');
  const { submissionId } = useParams<{ submissionId: string }>();
  const detail = useResultDetail(submissionId);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!detail.data) return;
    setExporting(true);
    try {
      await exportStudentResultPdf(detail.data);
      toastSuccess('PDF hasil ujian dibuat');
    } catch (error) {
      toastError(error, 'Gagal membuat PDF');
    } finally {
      setExporting(false);
    }
  };

  if (detail.isPending) {
    return <LoadingState label="Memuat hasil ujian..." />;
  }

  if (detail.isError) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/siswa/hasil">
            <ArrowLeft /> Riwayat nilai
          </Link>
        </Button>
        <ErrorState
          error={detail.error}
          title="Hasil belum dapat ditampilkan"
          onRetry={() => void detail.refetch()}
        />
      </div>
    );
  }

  if (!detail.data) return null;
  const { submission, exam, rows, canSeeKey } = detail.data;
  const pending = submission.perluManual > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Button asChild variant="ghost" size="sm">
        <Link to="/siswa/hasil">
          <ArrowLeft /> Riwayat nilai
        </Link>
      </Button>

      <PageHeader
        title={exam.nama}
        description={`${exam.mapel} • ${formatDateTime(submission.submitAt)}`}
        actions={
          <Button variant="outline" onClick={() => void handleExport()} disabled={exporting}>
            {exporting ? <Loader2 className="animate-spin" /> : <Download />} Unduh PDF
          </Button>
        }
      />

      {pending ? (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>
            Sebagian jawaban essay belum dinilai. Nilai akhir akan diperbarui otomatis setelah guru
            menyelesaikan koreksi.
          </p>
        </div>
      ) : null}

      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="flex flex-col items-center justify-center rounded-xl bg-accent/60 px-8 py-5">
            <p className="text-4xl font-bold tabular-nums text-primary">{formatNumber(submission.skor, 2)}</p>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Nilai akhir</p>
            <div className="mt-2">
              <SubmissionStatusBadge status={submission.status} />
            </div>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Nama</p>
              <p className="font-medium">{submission.studentName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">NIS / Kelas</p>
              <p className="font-medium">
                {submission.studentNis || '-'} / {submission.kelas || '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Dikumpulkan</p>
              <p className="font-medium">{formatDateTime(submission.submitAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Durasi pengerjaan</p>
              <p className="font-medium">{formatDuration(submission.durationSec)}</p>
            </div>
            <div className="sm:col-span-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="success">Benar {submission.benar}</Badge>
                <Badge variant="danger">Salah {submission.salah}</Badge>
                <Badge variant="outline">Kosong {submission.kosong}</Badge>
                {pending ? <Badge variant="warning">Essay belum dinilai {submission.perluManual}</Badge> : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rincian jawaban</CardTitle>
          <CardDescription>
            {canSeeKey
              ? 'Kunci dan pembahasan ditampilkan sesuai pengaturan ujian.'
              : 'Guru menyembunyikan kunci dan pembahasan untuk ujian ini.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.map((row) => {
            const state = verdict(row.answer);
            const Icon = state.icon;
            return (
              <div key={row.question.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">#{row.nomor}</span>
                  <QuestionTypeBadge tipe={row.question.tipe} />
                  <Badge variant="outline">Bobot {row.bobot}</Badge>
                  <Badge variant={state.variant} className="gap-1">
                    <Icon className="h-3 w-3" /> {state.label}
                  </Badge>
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                    {row.answer?.skor ?? 0} / {row.skorMaks}
                  </span>
                </div>
                <p className="prose-question mt-1.5 text-sm">{row.question.pertanyaan}</p>
                <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                  <div className="rounded bg-muted/40 p-2">
                    <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                      Jawaban Anda
                    </p>
                    <p className="whitespace-pre-wrap">
                      {describeAnswer(row.answer?.value ?? null, row.question.options)}
                    </p>
                  </div>
                  {canSeeKey ? (
                    <div className={cn('rounded p-2', row.answer?.benar ? 'bg-success/5' : 'bg-muted/40')}>
                      <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                        Kunci
                      </p>
                      <p>{describeKey(row.question.kunci, row.question.options)}</p>
                    </div>
                  ) : null}
                </div>
                {canSeeKey && row.question.pembahasan ? (
                  <div className="mt-2 rounded border-l-4 border-primary bg-accent/40 p-2 text-sm">
                    <p className="text-[11px] font-semibold uppercase text-primary">Pembahasan</p>
                    <p className="whitespace-pre-wrap">{row.question.pembahasan}</p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
