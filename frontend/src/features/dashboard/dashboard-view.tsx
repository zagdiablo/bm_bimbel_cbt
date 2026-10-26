import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, CalendarClock, CheckCircle2, Inbox } from 'lucide-react';
import type { Role } from '@/types/domain';
import { useAuthStore } from '@/stores/auth-store';
import { useDashboard } from './queries';
import { PageHeader } from '@/components/common/page-header';
import { StatCard } from '@/components/common/stat-card';
import { ErrorState } from '@/components/common/error-state';
import { TableSkeleton } from '@/components/common/loading-state';
import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScoreBadge } from '@/components/common/status-badges';
import { formatDateTime, formatRelative } from '@/lib/utils';
import { useDocumentTitle } from '@/hooks/use-document-title';

const COPY: Record<Role, { title: string; description: string; action?: { to: string; label: string } }> = {
  admin: {
    title: 'Dashboard Admin',
    description: 'Ringkasan penggunaan aplikasi, pengguna, dan aktivitas ujian.',
    action: { to: '/admin/pengguna', label: 'Kelola pengguna' },
  },
  guru: {
    title: 'Dashboard Guru',
    description: 'Pantau ujian Anda, bank soal, dan pekerjaan yang menunggu penilaian.',
    action: { to: '/guru/ujian/baru', label: 'Buat ujian' },
  },
  siswa: {
    title: 'Dashboard Siswa',
    description: 'Ujian yang tersedia dan ringkasan hasil belajar Anda.',
    action: { to: '/siswa/ujian', label: 'Lihat ujian' },
  },
};

export function DashboardView({ role }: { role: Role }) {
  useDocumentTitle('Dashboard');
  const user = useAuthStore((state) => state.user);
  const dashboard = useDashboard();
  const copy = COPY[role];

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.title}
        description={user ? `${copy.description} — ${user.name}` : copy.description}
        actions={
          copy.action ? (
            <Button asChild>
              <Link to={copy.action.to}>
                {copy.action.label} <ArrowRight />
              </Link>
            </Button>
          ) : null
        }
      />

      {dashboard.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : dashboard.isError ? (
        <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {dashboard.data.cards.map((card) => (
              <StatCard key={card.label} {...card} />
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Aktivitas 7 hari terakhir</CardTitle>
                <CardDescription>Jumlah pengerjaan ujian yang dikumpulkan per hari.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboard.data.chart} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(value: number | string) => [`${value} pengerjaan`, 'Jumlah']}
                      />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={44} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ujian tersedia</CardTitle>
                <CardDescription>Jadwal terdekat untuk Anda.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard.data.upcomingExams.length === 0 ? (
                  <EmptyState
                    icon={CalendarClock}
                    title="Belum ada ujian"
                    description="Ujian yang sudah diterbitkan akan muncul di sini."
                    className="border-0 bg-transparent py-6"
                  />
                ) : (
                  dashboard.data.upcomingExams.map((exam) => (
                    <div key={exam.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{exam.nama}</p>
                          <p className="text-xs text-muted-foreground">
                            {exam.mapel} • {exam.durasiMenit} menit
                          </p>
                        </div>
                        <Badge variant="outline">{exam.jumlahSoal} soal</Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatDateTime(exam.mulaiAt)} — {formatRelative(exam.selesaiAt)}
                      </p>
                      {role === 'siswa' ? (
                        <Button asChild size="sm" className="mt-2 w-full" variant={exam.attemptStatus === 'in_progress' ? 'default' : 'outline'}>
                          <Link to={`/siswa/ujian/${exam.id}/kerjakan`}>
                            {exam.attemptStatus === 'in_progress' ? 'Lanjutkan ujian' : 'Kerjakan'}
                          </Link>
                        </Button>
                      ) : role === 'guru' ? (
                        <Button asChild size="sm" variant="outline" className="mt-2 w-full">
                          <Link to={`/guru/ujian/${exam.id}`}>Kelola ujian</Link>
                        </Button>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Pengerjaan terbaru</CardTitle>
                <CardDescription>Hasil ujian yang baru dikumpulkan.</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard.data.recentSubmissions.length === 0 ? (
                  <EmptyState
                    icon={Inbox}
                    title="Belum ada pengerjaan"
                    description="Hasil akan tampil setelah siswa mengumpulkan ujian."
                    className="border-0 bg-transparent py-6"
                  />
                ) : (
                  <ul className="divide-y">
                    {dashboard.data.recentSubmissions.map((submission) => {
                      const target =
                        role === 'siswa' ? `/siswa/hasil/${submission.id}` : null;
                      const content = (
                        <>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {role === 'siswa' ? submission.examName : submission.studentName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {role === 'siswa'
                                ? formatDateTime(submission.submitAt)
                                : `${submission.kelas ?? '-'} • ${submission.examName ?? ''}`}
                            </p>
                          </div>
                          <ScoreBadge score={submission.skor} />
                        </>
                      );
                      return (
                        <li key={submission.id} className="flex items-center justify-between gap-3 py-2.5">
                          {target ? (
                            <Link to={target} className="flex flex-1 items-center justify-between gap-3 hover:opacity-80">
                              {content}
                            </Link>
                          ) : (
                            <div className="flex flex-1 items-center justify-between gap-3">{content}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Perlu dinilai</CardTitle>
                <CardDescription>Jawaban essay yang menunggu koreksi.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {role === 'siswa' ? (
                  <div className="flex items-start gap-2 rounded-lg bg-accent/50 p-3 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                    Nilai otomatis langsung tersedia setelah submit, kecuali soal essay.
                  </div>
                ) : dashboard.data.pendingGrading.length === 0 ? (
                  <EmptyState
                    icon={CheckCircle2}
                    title="Semua sudah dinilai"
                    description="Tidak ada jawaban essay yang menunggu."
                    className="border-0 bg-transparent py-6"
                  />
                ) : (
                  dashboard.data.pendingGrading.map((submission) => (
                    <div key={submission.id} className="rounded-lg border p-3">
                      <p className="truncate text-sm font-semibold">{submission.studentName}</p>
                      <p className="text-xs text-muted-foreground">{submission.examName}</p>
                      <Button asChild size="sm" variant="outline" className="mt-2 w-full">
                        <Link to={`/guru/hasil?examId=${submission.examId}&submission=${submission.id}`}>
                          Nilai sekarang
                        </Link>
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {dashboard.isFetching ? <TableSkeleton rows={1} columns={2} /> : null}
        </>
      )}
    </div>
  );
}
