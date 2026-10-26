import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { formatDateTime } from '@/lib/utils';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { TableSkeleton } from '@/components/common/loading-state';
import { Pagination } from '@/components/common/pagination';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function actionVariant(action: string): 'default' | 'info' | 'success' | 'warning' | 'danger' {
  if (action.startsWith('auth.login') || action.startsWith('exam.submit')) return 'success';
  if (action.includes('delete')) return 'danger';
  if (action.includes('import') || action.includes('grade')) return 'info';
  if (action.includes('event') || action.includes('auto_submit')) return 'warning';
  return 'default';
}

export function ActivityPage() {
  useDocumentTitle('Aktivitas');
  const [page, setPage] = useState(1);
  const logs = useQuery({
    queryKey: qk.logs(page),
    queryFn: () => api.logs.list({ page, pageSize: 20 }),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Log Aktivitas"
        description="Jejak audit login, perubahan data, pengerjaan ujian, dan peringatan fokus."
        actions={
          <Button variant="outline" onClick={() => void logs.refetch()} disabled={logs.isFetching}>
            <RefreshCw className={logs.isFetching ? 'animate-spin' : undefined} /> Muat ulang
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4 sm:p-5">
          {logs.isPending ? (
            <TableSkeleton rows={8} columns={4} />
          ) : logs.isError ? (
            <ErrorState error={logs.error} onRetry={() => void logs.refetch()} />
          ) : logs.data.items.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="Belum ada aktivitas"
              description="Log akan terisi otomatis saat pengguna mulai menggunakan aplikasi."
            />
          ) : (
            <>
              <div className="space-y-2 md:hidden">
                {logs.data.items.map((entry) => (
                  <div key={entry.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant={actionVariant(entry.action)}>{entry.action}</Badge>
                      <span className="text-[11px] text-muted-foreground">{formatDateTime(entry.ts)}</span>
                    </div>
                    <p className="mt-1.5 font-medium">{entry.actorName ?? 'Sistem'}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.entity ?? '-'} {entry.entityId ? `• ${entry.entityId}` : ''}
                    </p>
                  </div>
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Waktu</TableHead>
                      <TableHead>Aktor</TableHead>
                      <TableHead>Aksi</TableHead>
                      <TableHead>Entitas</TableHead>
                      <TableHead>Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.data.items.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateTime(entry.ts)}
                        </TableCell>
                        <TableCell className="text-sm">{entry.actorName ?? 'Sistem'}</TableCell>
                        <TableCell>
                          <Badge variant={actionVariant(entry.action)}>{entry.action}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {entry.entity ?? '-'}
                          {entry.entityId ? ` • ${entry.entityId}` : ''}
                        </TableCell>
                        <TableCell className="max-w-[16rem] truncate text-xs text-muted-foreground" title={JSON.stringify(entry.meta ?? {})}>
                          {entry.meta ? JSON.stringify(entry.meta) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Pagination
                page={logs.data.page}
                pageSize={logs.data.pageSize}
                total={logs.data.total}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
