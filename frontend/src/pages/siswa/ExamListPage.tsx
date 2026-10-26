import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardList, Clock, LockKeyhole, PlayCircle } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useExams } from '@/features/exams/queries';
import { formatDateTime, formatRelative } from '@/lib/utils';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { LoadingState } from '@/components/common/loading-state';
import { SearchInput } from '@/components/common/search-input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function SiswaExamListPage() {
  useDocumentTitle('Ujian Saya');
  const [search, setSearch] = useState('');
  const exams = useExams({ q: search, status: '', page: 1, pageSize: 50 });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ujian Saya"
        description="Ujian yang tersedia sesuai kelas dan jadwal Anda."
      />

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Cari ujian atau mata pelajaran..."
        className="max-w-md"
      />

      {exams.isPending ? (
        <LoadingState label="Memuat daftar ujian..." />
      ) : exams.isError ? (
        <ErrorState error={exams.error} onRetry={() => void exams.refetch()} />
      ) : exams.data.items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Belum ada ujian tersedia"
          description="Ujian akan muncul di sini setelah guru menerbitkannya sesuai kelas Anda."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {exams.data.items.map((exam) => {
            const inProgress = exam.attemptStatus === 'in_progress';
            const finished = exam.attemptStatus && !inProgress;
            return (
              <Card key={exam.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge>{exam.mapel}</Badge>
                    <Badge variant="outline">{exam.durasiMenit} menit</Badge>
                    {exam.requiresToken ? (
                      <Badge variant="warning" className="gap-1">
                        <LockKeyhole className="h-3 w-3" /> Token
                      </Badge>
                    ) : null}
                  </div>
                  <CardTitle className="mt-2 line-clamp-2 text-base">{exam.nama}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {exam.deskripsi || 'Ujian online dengan timer dan penilaian otomatis.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto space-y-3">
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> {formatDateTime(exam.mulaiAt)}
                    </p>
                    <p>Berakhir {formatRelative(exam.selesaiAt)}</p>
                    <p className="font-medium text-foreground">{exam.jumlahSoal} soal</p>
                  </div>
                  {finished ? (
                    <Button asChild variant="outline" className="w-full">
                      <Link to={exam.submissionId ? `/siswa/hasil/${exam.submissionId}` : '/siswa/hasil'}>
                        Lihat hasil <ArrowRight />
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild className="w-full" variant={inProgress ? 'default' : 'outline'}>
                      <Link to={`/siswa/ujian/${exam.id}/kerjakan`}>
                        <PlayCircle /> {inProgress ? 'Lanjutkan ujian' : 'Kerjakan ujian'}
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
