import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  CalendarClock,
  ClipboardList,
  Eye,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';
import type { Exam } from '@/types/domain';
import { EMPTY_EXAM_FILTERS, EXAM_STATUS_LABELS } from '@/lib/constants';
import { formatDateTime } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';
import { useDocumentTitle } from '@/hooks/use-document-title';
import {
  useCloseExam,
  useDeleteExam,
  useExams,
  usePublishExam,
} from '@/features/exams/queries';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { TableSkeleton } from '@/components/common/loading-state';
import { Pagination } from '@/components/common/pagination';
import { SearchInput } from '@/components/common/search-input';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ExamStatusBadge } from '@/components/common/status-badges';
import { ExamPreviewDialog } from '@/features/exams/components/exam-preview-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type PendingAction = { type: 'publish' | 'close' | 'delete'; exam: Exam };

const ACTION_COPY: Record<
  PendingAction['type'],
  { title: string; description: string; confirm: string; tone: 'danger' | 'primary' }
> = {
  publish: {
    title: 'Terbitkan ujian?',
    description: 'Siswa pada kelas target dapat mulai mengerjakan sesuai jadwal.',
    confirm: 'Terbitkan',
    tone: 'primary',
  },
  close: {
    title: 'Tutup ujian?',
    description: 'Siswa tidak dapat memulai ujian lagi. Pengerjaan yang berlangsung tetap dapat dikumpulkan.',
    confirm: 'Tutup ujian',
    tone: 'primary',
  },
  delete: {
    title: 'Hapus ujian?',
    description: 'Ujian dan daftar soalnya dihapus permanen. Ujian dengan peserta tidak dapat dihapus.',
    confirm: 'Hapus',
    tone: 'danger',
  },
};

function ExamActions({
  exam,
  onPreview,
  onAction,
}: {
  exam: Exam;
  onPreview: (exam: Exam) => void;
  onAction: (action: PendingAction) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Aksi untuk ${exam.nama}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild>
          <Link to={`/guru/ujian/${exam.id}`}>
            <Pencil /> Edit ujian
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onPreview(exam)}>
          <Eye /> Pratinjau soal
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/guru/hasil?examId=${exam.id}`}>
            <BarChart3 /> Hasil & nilai
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {exam.status === 'draft' ? (
          <DropdownMenuItem onSelect={() => onAction({ type: 'publish', exam })}>
            <Send /> Terbitkan
          </DropdownMenuItem>
        ) : null}
        {exam.status === 'published' ? (
          <DropdownMenuItem onSelect={() => onAction({ type: 'close', exam })}>
            <XCircle /> Tutup ujian
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem destructive onSelect={() => onAction({ type: 'delete', exam })}>
          <Trash2 /> Hapus
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ExamListPage() {
  useDocumentTitle('Ujian');
  const [filters, setFilters] = useState({ ...EMPTY_EXAM_FILTERS });
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const debouncedQuery = useDebounce(filters.q ?? '', 400);
  const queryFilters = useMemo(
    () => ({ ...filters, q: debouncedQuery, page: filters.page ?? 1, pageSize: filters.pageSize ?? 20 }),
    [filters, debouncedQuery],
  );
  const exams = useExams(queryFilters);
  const publish = usePublishExam();
  const close = useCloseExam();
  const remove = useDeleteExam();

  const confirmAction = () => {
    if (!pending) return;
    const options = { onSuccess: () => setPending(null) };
    if (pending.type === 'publish') publish.mutate(pending.exam.id, options);
    if (pending.type === 'close') close.mutate(pending.exam.id, options);
    if (pending.type === 'delete') remove.mutate(pending.exam.id, options);
  };

  const busy = publish.isPending || close.isPending || remove.isPending;
  const copy = pending ? ACTION_COPY[pending.type] : null;
  const isFiltered = Boolean(filters.q || filters.status);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Manajemen Ujian"
        description="Buat ujian, atur jadwal, pilih soal, dan pantau pesertanya."
        actions={
          <Button asChild>
            <Link to="/guru/ujian/baru">
              <Plus /> Buat ujian
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-[1.6fr_1fr]">
            <SearchInput
              value={filters.q ?? ''}
              onChange={(q) => setFilters((current) => ({ ...current, q, page: 1 }))}
              placeholder="Cari nama ujian atau mapel..."
            />
            <Select
              value={filters.status || 'all'}
              onValueChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  status: value === 'all' ? '' : (value as Exam['status']),
                  page: 1,
                }))
              }
            >
              <SelectTrigger aria-label="Filter status ujian">
                <SelectValue placeholder="Semua status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua status</SelectItem>
                {Object.entries(EXAM_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {exams.isPending ? (
            <TableSkeleton rows={5} columns={4} />
          ) : exams.isError ? (
            <ErrorState error={exams.error} onRetry={() => void exams.refetch()} />
          ) : exams.data.items.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={isFiltered ? 'Tidak ada ujian yang cocok' : 'Belum ada ujian'}
              description={
                isFiltered
                  ? 'Ubah filter atau reset pencarian.'
                  : 'Buat ujian pertama Anda, pilih soal dari bank soal, lalu terbitkan.'
              }
              action={
                isFiltered ? (
                  <Button variant="outline" onClick={() => setFilters({ ...EMPTY_EXAM_FILTERS })}>
                    Reset filter
                  </Button>
                ) : (
                  <Button asChild>
                    <Link to="/guru/ujian/baru">
                      <Plus /> Buat ujian
                    </Link>
                  </Button>
                )
              }
            />
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {exams.data.items.map((exam) => (
                  <div key={exam.id} className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{exam.nama}</p>
                        <p className="text-xs text-muted-foreground">
                          {exam.mapel} • {exam.durasiMenit} menit
                        </p>
                      </div>
                      <ExamActions exam={exam} onPreview={(item) => setPreviewId(item.id)} onAction={setPending} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <ExamStatusBadge status={exam.status} />
                      <Badge variant="outline">{exam.questionCount} soal</Badge>
                      {exam.token ? (
                        <Badge variant="secondary" className="gap-1">
                          <Lock className="h-3 w-3" /> Token
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarClock className="h-3.5 w-3.5" /> {formatDateTime(exam.mulaiAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">s.d. {formatDateTime(exam.selesaiAt)}</p>
                  </div>
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ujian</TableHead>
                      <TableHead>Jadwal</TableHead>
                      <TableHead>Soal</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exams.data.items.map((exam) => (
                      <TableRow key={exam.id}>
                        <TableCell>
                          <p className="font-medium">{exam.nama}</p>
                          <p className="text-xs text-muted-foreground">
                            {exam.mapel}
                            {exam.token ? ' • memakai token' : ''}
                          </p>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          <p>{formatDateTime(exam.mulaiAt)}</p>
                          <p className="text-muted-foreground">{formatDateTime(exam.selesaiAt)}</p>
                        </TableCell>
                        <TableCell className="text-xs">
                          <p>{exam.questionCount} soal</p>
                          <p className="text-muted-foreground">{exam.jumlahSoal} diujikan</p>
                        </TableCell>
                        <TableCell>
                          <ExamStatusBadge status={exam.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <ExamActions exam={exam} onPreview={(item) => setPreviewId(item.id)} onAction={setPending} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Pagination
                page={exams.data.page}
                pageSize={exams.data.pageSize}
                total={exams.data.total}
                onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
              />
            </>
          )}
        </CardContent>
      </Card>

      <ExamPreviewDialog
        examId={previewId}
        open={Boolean(previewId)}
        onOpenChange={(open) => {
          if (!open) setPreviewId(null);
        }}
      />
      <ConfirmDialog
        open={Boolean(pending)}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={copy?.title ?? ''}
        description={
          <span>
            {copy?.description ?? ''}
            {pending ? (
              <>
                {' '}
                Ujian: <strong>{pending.exam.nama}</strong>.
              </>
            ) : null}
          </span>
        }
        confirmLabel={copy?.confirm}
        tone={copy?.tone}
        pending={busy}
        onConfirm={confirmAction}
      />
    </div>
  );
}
