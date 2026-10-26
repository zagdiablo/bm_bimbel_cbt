import { Link } from 'react-router-dom';
import { ArrowRight, History, Trophy } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useMyResults } from '@/features/results/queries';
import { formatDateTime, formatDuration, formatNumber } from '@/lib/utils';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { LoadingState } from '@/components/common/loading-state';
import { StatCard } from '@/components/common/stat-card';
import { ScoreBadge, SubmissionStatusBadge } from '@/components/common/status-badges';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function HistoryPage() {
  useDocumentTitle('Riwayat Nilai');
  const results = useMyResults();

  const items = results.data?.items ?? [];
  const scores = items.map((item) => item.skor);
  const average = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const best = scores.length ? Math.max(...scores) : 0;

  return (
    <div className="space-y-5">
      <PageHeader title="Riwayat Nilai" description="Semua ujian yang sudah Anda kumpulkan." />

      {results.isPending ? (
        <LoadingState label="Memuat riwayat..." />
      ) : results.isError ? (
        <ErrorState error={results.error} onRetry={() => void results.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={History}
          title="Belum ada riwayat ujian"
          description="Setelah menyelesaikan ujian, nilai dan pembahasan akan tampil di sini."
          action={
            <Button asChild>
              <Link to="/siswa/ujian">Lihat ujian tersedia</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Ujian selesai" value={String(items.length)} icon="submissions" />
            <StatCard label="Rata-rata nilai" value={formatNumber(average, 2)} icon="score" />
            <StatCard label="Nilai terbaik" value={formatNumber(best, 2)} icon="score" hint="Dari seluruh ujian" />
          </div>

          <div className="space-y-3 md:hidden">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{item.examName}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(item.submitAt)}</p>
                  </div>
                  <ScoreBadge score={item.skor} />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <SubmissionStatusBadge status={item.status} />
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/siswa/hasil/${item.id}`}>
                      Detail <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden rounded-xl border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ujian</TableHead>
                  <TableHead className="text-center">Benar / Salah</TableHead>
                  <TableHead className="text-center">Nilai</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dikumpulkan</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="font-medium">{item.examName}</p>
                      <p className="text-xs text-muted-foreground">
                        Durasi {formatDuration(item.durationSec)}
                      </p>
                    </TableCell>
                    <TableCell className="text-center text-xs tabular-nums">
                      {item.benar} / {item.salah}
                      {item.perluManual > 0 ? (
                        <span className="ml-1 text-warning">• {item.perluManual} essay</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-center">
                      <ScoreBadge score={item.skor} />
                    </TableCell>
                    <TableCell>
                      <SubmissionStatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(item.submitAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/siswa/hasil/${item.id}`}>
                          Detail <ArrowRight />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {best >= 90 ? (
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
              <Trophy className="h-4 w-4 text-success" />
              Nilai terbaik Anda {formatNumber(best, 2)}. Pertahankan!
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
