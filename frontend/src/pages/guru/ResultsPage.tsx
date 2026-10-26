import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList, Eye, FileCheck2 } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useExams } from '@/features/exams/queries';
import { useSubmissions } from '@/features/results/queries';
import { ExportButtons } from '@/features/results/components/export-buttons';
import { SubmissionDetailDialog } from '@/features/results/components/submission-detail-dialog';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { TableSkeleton } from '@/components/common/loading-state';
import { Pagination } from '@/components/common/pagination';
import { ScoreBadge, SubmissionStatusBadge } from '@/components/common/status-badges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function ResultsPage() {
  useDocumentTitle('Hasil & Penilaian');
  const [params] = useSearchParams();
  const exams = useExams({ q: '', status: '', page: 1, pageSize: 100 });
  const [examId, setExamId] = useState(params.get('examId') ?? '');
  const [tab, setTab] = useState<'all' | 'grading'>('all');
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(params.get('submission'));

  useEffect(() => {
    if (!examId && exams.data?.items[0]) setExamId(exams.data.items[0].id);
  }, [exams.data, examId]);

  const filters = useMemo(
    () => ({
      examId: examId || undefined,
      status: tab === 'grading' ? ('needs_grading' as const) : ('' as const),
      page,
      pageSize: 20,
    }),
    [examId, tab, page],
  );
  const submissions = useSubmissions(filters);
  const selectedExam = exams.data?.items.find((exam) => exam.id === examId);

  const changeExam = (value: string) => {
    setExamId(value);
    setPage(1);
    setTab('all');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Hasil & Penilaian"
        description="Rekap nilai seluruh peserta, koreksi essay, dan cetak laporan."
        actions={<ExportButtons examId={examId || null} disabled={!selectedExam} />}
      />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full max-w-md space-y-1.5">
              <label htmlFor="exam-selector" className="text-xs font-medium text-muted-foreground">
                Pilih ujian
              </label>
              <Select value={examId} onValueChange={changeExam} disabled={exams.isPending}>
                <SelectTrigger id="exam-selector">
                  <SelectValue placeholder="Pilih ujian untuk melihat hasil" />
                </SelectTrigger>
                <SelectContent>
                  {(exams.data?.items ?? []).map((exam) => (
                    <SelectItem key={exam.id} value={exam.id}>
                      {exam.nama} • {exam.mapel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedExam ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{selectedExam.questionCount} soal</Badge>
                <span>{formatDateTime(selectedExam.mulaiAt)}</span>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
          {exams.isError ? (
            <ErrorState error={exams.error} onRetry={() => void exams.refetch()} />
          ) : !examId ? (
            <EmptyState
              icon={ClipboardList}
              title={exams.isPending ? 'Memuat ujian...' : 'Belum ada ujian'}
              description="Buat ujian terlebih dahulu, lalu hasil siswa akan muncul di sini."
            />
          ) : (
            <Tabs
              value={tab}
              onValueChange={(value) => {
                setTab(value as 'all' | 'grading');
                setPage(1);
              }}
            >
              <TabsList>
                <TabsTrigger value="all">Semua peserta</TabsTrigger>
                <TabsTrigger value="grading">
                  <FileCheck2 className="mr-1.5 h-3.5 w-3.5" /> Perlu dinilai
                </TabsTrigger>
              </TabsList>

              <TabsContent value={tab}>
                {submissions.isPending ? (
                  <TableSkeleton rows={6} columns={5} />
                ) : submissions.isError ? (
                  <ErrorState error={submissions.error} onRetry={() => void submissions.refetch()} />
                ) : submissions.data.items.length === 0 ? (
                  <EmptyState
                    icon={FileCheck2}
                    title={tab === 'grading' ? 'Tidak ada yang perlu dinilai' : 'Belum ada peserta'}
                    description={
                      tab === 'grading'
                        ? 'Semua jawaban essay sudah dikoreksi.'
                        : 'Hasil akan tampil setelah siswa mengumpulkan ujian.'
                    }
                  />
                ) : (
                  <>
                    <div className="space-y-3 md:hidden">
                      {submissions.data.items.map((submission) => (
                        <div key={submission.id} className="rounded-lg border p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{submission.studentName}</p>
                              <p className="text-xs text-muted-foreground">
                                {submission.studentNis || '-'} • {submission.kelas || '-'}
                              </p>
                            </div>
                            <ScoreBadge score={submission.skor} />
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <SubmissionStatusBadge status={submission.status} />
                            <Button size="sm" variant="outline" onClick={() => setDetailId(submission.id)}>
                              <Eye /> Detail
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="hidden md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Peserta</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-center">Benar / Salah</TableHead>
                            <TableHead className="text-center">Nilai</TableHead>
                            <TableHead>Dikumpulkan</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {submissions.data.items.map((submission) => (
                            <TableRow key={submission.id}>
                              <TableCell>
                                <p className="font-medium">{submission.studentName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {submission.studentNis || '-'} • {submission.kelas || '-'}
                                </p>
                              </TableCell>
                              <TableCell>
                                <SubmissionStatusBadge status={submission.status} />
                              </TableCell>
                              <TableCell className="text-center text-xs tabular-nums">
                                {submission.benar} / {submission.salah}
                                {submission.perluManual > 0 ? (
                                  <span className="ml-1 text-warning">({submission.perluManual} essay)</span>
                                ) : null}
                              </TableCell>
                              <TableCell className="text-center">
                                <ScoreBadge score={submission.skor} />
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                {formatDateTime(submission.submitAt)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button size="sm" variant="outline" onClick={() => setDetailId(submission.id)}>
                                  <Eye /> Detail
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <Pagination
                      page={submissions.data.page}
                      pageSize={submissions.data.pageSize}
                      total={submissions.data.total}
                      onPageChange={setPage}
                    />
                  </>
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Catatan penilaian</CardTitle>
          <CardDescription>
            PG, PG kompleks, benar/salah, dan isian dinilai otomatis. Essay perlu dikoreksi manual;
            nilai akhir dihitung ulang otomatis setelah semua essay dinilai.
          </CardDescription>
        </CardHeader>
      </Card>

      <SubmissionDetailDialog
        submissionId={detailId}
        open={Boolean(detailId)}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
      />
    </div>
  );
}
