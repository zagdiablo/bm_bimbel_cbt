import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useExams } from '@/features/exams/queries';
import { useExamStats } from '@/features/results/queries';
import { ExportButtons } from '@/features/results/components/export-buttons';
import { PageHeader } from '@/components/common/page-header';
import { StatCard } from '@/components/common/stat-card';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { LoadingState } from '@/components/common/loading-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatNumber } from '@/lib/utils';

const BAR_COLORS = ['#dc2626', '#f59e0b', '#eab308', '#0d9488', '#0f766e'];

export function StatisticsPage() {
  useDocumentTitle('Statistik');
  const exams = useExams({ q: '', status: '', page: 1, pageSize: 100 });
  const [examId, setExamId] = useState('');
  const stats = useExamStats(examId || null);

  useEffect(() => {
    if (!examId && exams.data?.items[0]) setExamId(exams.data.items[0].id);
  }, [exams.data, examId]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Statistik Ujian"
        description="Analisis distribusi nilai dan tingkat kesulitan tiap soal."
        actions={<ExportButtons examId={examId || null} disabled={!examId} />}
      />

      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="w-full max-w-md space-y-1.5">
            <label htmlFor="stats-exam" className="text-xs font-medium text-muted-foreground">
              Pilih ujian
            </label>
            <Select value={examId} onValueChange={setExamId} disabled={exams.isPending}>
              <SelectTrigger id="stats-exam">
                <SelectValue placeholder="Pilih ujian" />
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
        </CardContent>
      </Card>

      {exams.isError ? (
        <ErrorState error={exams.error} onRetry={() => void exams.refetch()} />
      ) : !examId ? (
        <EmptyState
          icon={BarChart3}
          title="Pilih ujian"
          description="Statistik muncul setelah ujian memiliki peserta yang mengumpulkan jawaban."
        />
      ) : stats.isPending ? (
        <LoadingState label="Menghitung statistik..." />
      ) : stats.isError ? (
        <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
      ) : stats.data.count === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Belum ada data"
          description="Belum ada siswa yang menyelesaikan ujian ini."
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Peserta" value={String(stats.data.count)} icon="users" />
            <StatCard label="Rata-rata" value={formatNumber(stats.data.avg, 2)} icon="score" />
            <StatCard label="Nilai tertinggi" value={formatNumber(stats.data.max, 2)} icon="score" />
            <StatCard
              label="Lulus (≥75)"
              value={`${stats.data.passed}/${stats.data.count}`}
              hint={`Terendah ${formatNumber(stats.data.min, 2)}`}
              icon="score"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Distribusi nilai</CardTitle>
              <CardDescription>Sebaran jumlah siswa per rentang nilai.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.data.distribution} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
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
                      formatter={(value: number | string) => [`${value} siswa`, 'Jumlah']}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56}>
                      {stats.data.distribution.map((item, index) => (
                        <Cell key={item.label} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Analisis butir soal</CardTitle>
              <CardDescription>
                Persentase benar membantu mengidentifikasi soal yang terlalu sulit atau ambigu.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-center">No</TableHead>
                    <TableHead>Soal</TableHead>
                    <TableHead className="text-center">Benar</TableHead>
                    <TableHead className="text-center">Salah</TableHead>
                    <TableHead className="text-center">Kosong</TableHead>
                    <TableHead className="min-w-[10rem]">Akurasi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.data.perQuestion.map((item) => {
                    const answered = item.benar + item.salah;
                    const accuracy = answered > 0 ? Math.round((item.benar / answered) * 100) : 0;
                    return (
                      <TableRow key={item.questionId}>
                        <TableCell className="text-center text-xs text-muted-foreground">{item.nomor}</TableCell>
                        <TableCell>
                          <p className="line-clamp-2 text-sm">{item.pertanyaan}</p>
                        </TableCell>
                        <TableCell className="text-center tabular-nums">{item.benar}</TableCell>
                        <TableCell className="text-center tabular-nums">{item.salah}</TableCell>
                        <TableCell className="text-center tabular-nums">{item.kosong}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={accuracy} className="h-2 flex-1" />
                            <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                              {accuracy}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
