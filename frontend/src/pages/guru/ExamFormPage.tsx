import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Eye, Loader2, Save, Send } from 'lucide-react';
import type { Exam } from '@/types/domain';
import type { ExamInput } from '@/types/api';
import { parseCsv, jakartaInputToIso, toLocalInputValue } from '@/lib/utils';
import { errorMessage } from '@/lib/notify';
import { useDocumentTitle } from '@/hooks/use-document-title';
import {
  useCreateExam,
  useExam,
  usePublishExam,
  useSetExamQuestions,
  useUpdateExam,
} from '@/features/exams/queries';
import { PageHeader } from '@/components/common/page-header';
import { PageLoader } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { ExamStatusBadge } from '@/components/common/status-badges';
import { QuestionPicker } from '@/features/exams/components/question-picker';
import { ExamPreviewDialog } from '@/features/exams/components/exam-preview-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

const schema = z
  .object({
    nama: z.string().trim().min(3, 'Nama ujian minimal 3 karakter.'),
    mapel: z.string().trim().min(2, 'Mata pelajaran wajib diisi.'),
    deskripsi: z.string(),
    durasiMenit: z.coerce.number().int('Durasi harus bilangan bulat.').min(5, 'Minimal 5 menit.').max(480, 'Maksimal 480 menit.'),
    mulaiAt: z.string().min(1, 'Jadwal mulai wajib diisi.'),
    selesaiAt: z.string().min(1, 'Jadwal selesai wajib diisi.'),
    jumlahSoal: z.coerce.number().int('Harus bilangan bulat.').min(1, 'Minimal 1 soal.').max(200, 'Maksimal 200 soal.'),
    acakSoal: z.boolean(),
    acakOpsi: z.boolean(),
    tampilkanPembahasan: z.boolean(),
    tampilkanNilai: z.boolean(),
    token: z.string(),
    kelas: z.string(),
  })
  .superRefine((values, ctx) => {
    const start = new Date(jakartaInputToIso(values.mulaiAt)).getTime();
    const end = new Date(jakartaInputToIso(values.selesaiAt)).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['selesaiAt'],
        message: 'Waktu selesai harus setelah waktu mulai.',
      });
    }
    if (values.token.trim() && values.token.trim().length < 4) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['token'],
        message: 'Token minimal 4 karakter (atau kosongkan).',
      });
    }
  });

type FormValues = z.infer<typeof schema>;

function defaultValues(exam?: Exam): FormValues {
  const start = exam ? exam.mulaiAt : new Date().toISOString();
  const end = exam ? exam.selesaiAt : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  return {
    nama: exam?.nama ?? '',
    mapel: exam?.mapel ?? '',
    deskripsi: exam?.deskripsi ?? '',
    durasiMenit: exam?.durasiMenit ?? 30,
    mulaiAt: toLocalInputValue(start),
    selesaiAt: toLocalInputValue(end),
    jumlahSoal: exam?.jumlahSoal ?? 5,
    acakSoal: exam?.acakSoal ?? true,
    acakOpsi: exam?.acakOpsi ?? true,
    tampilkanPembahasan: exam?.tampilkanPembahasan ?? false,
    tampilkanNilai: exam?.tampilkanNilai ?? true,
    token: exam?.token ?? '',
    kelas: exam?.kelasTarget.join(', ') ?? '',
  };
}

function toExamInput(values: FormValues): ExamInput {
  return {
    nama: values.nama.trim(),
    mapel: values.mapel.trim(),
    deskripsi: values.deskripsi.trim(),
    durasiMenit: values.durasiMenit,
    mulaiAt: jakartaInputToIso(values.mulaiAt),
    selesaiAt: jakartaInputToIso(values.selesaiAt),
    jumlahSoal: values.jumlahSoal,
    acakSoal: values.acakSoal,
    acakOpsi: values.acakOpsi,
    tampilkanPembahasan: values.tampilkanPembahasan,
    tampilkanNilai: values.tampilkanNilai,
    token: values.token.trim() || undefined,
    kelasTarget: parseCsv(values.kelas),
  };
}

export function ExamFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  useDocumentTitle(isEdit ? 'Edit Ujian' : 'Buat Ujian');
  const navigate = useNavigate();
  const examQuery = useExam(id);
  const create = useCreateExam();
  const update = useUpdateExam();
  const setQuestions = useSetExamQuestions();
  const publish = usePublishExam();

  const [selected, setSelected] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const pending = create.isPending || update.isPending || setQuestions.isPending || publish.isPending;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(examQuery.data?.exam),
  });

  const loadedExamId = examQuery.data?.exam.id;

  useEffect(() => {
    if (!examQuery.data) return;
    form.reset(defaultValues(examQuery.data.exam));
    setSelected(examQuery.data.questions.map((question) => question.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedExamId]);

  const jumlahSoal = form.watch('jumlahSoal');

  const handleSave = async (values: FormValues, andPublish: boolean) => {
    setFormError(null);
    if (andPublish && selected.length === 0 && !isEdit) {
      setFormError('Pilih minimal satu soal sebelum menerbitkan ujian.');
      return;
    }
    try {
      let examId = id ?? '';
      const input = toExamInput(values);
      if (examId) {
        await update.mutateAsync({ id: examId, input });
      } else {
        const created = await create.mutateAsync(input);
        examId = created.exam.id;
      }
      if (selected.length > 0) {
        await setQuestions.mutateAsync({ examId, questionIds: selected });
      }
      if (andPublish) {
        await publish.mutateAsync(examId);
      }
      if (!id) {
        navigate(`/guru/ujian/${examId}`, { replace: true });
      } else {
        await examQuery.refetch();
      }
    } catch (error) {
      setFormError(errorMessage(error));
    }
  };

  if (isEdit && examQuery.isPending) return <PageLoader label="Memuat ujian..." />;
  if (isEdit && examQuery.isError) {
    return <ErrorState error={examQuery.error} onRetry={() => void examQuery.refetch()} />;
  }

  const exam = examQuery.data?.exam;
  const errors = form.formState.errors;

  return (
    <div className="space-y-5">
      <PageHeader
        title={isEdit ? 'Edit ujian' : 'Buat ujian baru'}
        description="Atur jadwal, durasi, peserta, dan pilih soal dari bank soal."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/guru/ujian">
                <ArrowLeft /> Kembali
              </Link>
            </Button>
            {isEdit ? (
              <Button variant="outline" onClick={() => setPreviewOpen(true)}>
                <Eye /> Pratinjau
              </Button>
            ) : null}
            <Button
              type="button"
              disabled={pending}
              onClick={() => void form.handleSubmit((values) => handleSave(values, false))()}
            >
              {pending ? <Loader2 className="animate-spin" /> : <Save />} Simpan
            </Button>
          </>
        }
      />

      {exam ? (
        <div className="flex flex-wrap items-center gap-2">
          <ExamStatusBadge status={exam.status} />
          <Badge variant="outline">{exam.questionCount} soal terpilih</Badge>
          <span className="text-xs text-muted-foreground">
            Dibuat {new Date(exam.createdAt).toLocaleDateString('id-ID')}
          </span>
        </div>
      ) : null}

      {formError ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {formError}
        </div>
      ) : null}

      <form
        onSubmit={(event) => void form.handleSubmit((values) => handleSave(values, false))(event)}
        className="grid gap-4 xl:grid-cols-[1.35fr_1fr]"
        noValidate
      >
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Informasi ujian</CardTitle>
              <CardDescription>Identitas ujian yang dilihat siswa.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="exam-nama">Nama ujian</Label>
                <Input id="exam-nama" placeholder="Ulangan Harian Bab 1" {...form.register('nama')} aria-invalid={Boolean(errors.nama)} />
                {errors.nama ? <p className="text-xs text-destructive">{errors.nama.message}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exam-mapel">Mata pelajaran</Label>
                <Input id="exam-mapel" placeholder="Matematika" {...form.register('mapel')} aria-invalid={Boolean(errors.mapel)} />
                {errors.mapel ? <p className="text-xs text-destructive">{errors.mapel.message}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exam-durasi">Durasi (menit)</Label>
                <Input id="exam-durasi" type="number" min={5} max={480} {...form.register('durasiMenit')} aria-invalid={Boolean(errors.durasiMenit)} />
                {errors.durasiMenit ? <p className="text-xs text-destructive">{errors.durasiMenit.message}</p> : null}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="exam-deskripsi">Deskripsi / instruksi</Label>
                <Textarea id="exam-deskripsi" rows={3} placeholder="Petunjuk pengerjaan untuk siswa..." {...form.register('deskripsi')} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Jadwal & peserta</CardTitle>
              <CardDescription>Waktu menggunakan zona Asia/Jakarta (WIB).</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="exam-mulai">Mulai</Label>
                <Input id="exam-mulai" type="datetime-local" {...form.register('mulaiAt')} aria-invalid={Boolean(errors.mulaiAt)} />
                {errors.mulaiAt ? <p className="text-xs text-destructive">{errors.mulaiAt.message}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exam-selesai">Selesai</Label>
                <Input id="exam-selesai" type="datetime-local" {...form.register('selesaiAt')} aria-invalid={Boolean(errors.selesaiAt)} />
                {errors.selesaiAt ? <p className="text-xs text-destructive">{errors.selesaiAt.message}</p> : null}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="exam-kelas">Kelas peserta</Label>
                <Input id="exam-kelas" placeholder="XII-IPA-1, XII-IPA-2 (kosongkan untuk semua kelas)" {...form.register('kelas')} />
                <p className="text-xs text-muted-foreground">
                  Pisahkan dengan koma. Siswa di luar kelas ini tidak dapat memulai ujian.
                </p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="exam-token">Token ujian (opsional)</Label>
                <Input id="exam-token" placeholder="Contoh: MTK2026" {...form.register('token')} aria-invalid={Boolean(errors.token)} />
                {errors.token ? <p className="text-xs text-destructive">{errors.token.message}</p> : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pengaturan pengerjaan</CardTitle>
              <CardDescription>Acak soal/opsi dan visibilitas hasil.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5 sm:max-w-[12rem]">
                <Label htmlFor="exam-jumlah">Jumlah soal diujikan</Label>
                <Input id="exam-jumlah" type="number" min={1} max={200} {...form.register('jumlahSoal')} aria-invalid={Boolean(errors.jumlahSoal)} />
                {errors.jumlahSoal ? <p className="text-xs text-destructive">{errors.jumlahSoal.message}</p> : null}
                {selected.length > 0 && jumlahSoal > selected.length ? (
                  <p className="text-xs text-warning">
                    Hanya {selected.length} soal tersedia; semua soal akan dipakai.
                  </p>
                ) : null}
              </div>

              {[
                { name: 'acakSoal' as const, label: 'Acak urutan soal', hint: 'Urutan diacak per siswa dan disimpan agar konsisten saat resume.' },
                { name: 'acakOpsi' as const, label: 'Acak urutan opsi', hint: 'Opsi diacak di perangkat siswa secara deterministik.' },
                { name: 'tampilkanPembahasan' as const, label: 'Tampilkan pembahasan', hint: 'Pembahasan tampil di halaman hasil siswa.' },
                { name: 'tampilkanNilai' as const, label: 'Tampilkan nilai ke siswa', hint: 'Jika dimatikan, nilai hanya terlihat setelah ujian ditutup.' },
              ].map((item) => (
                <div key={item.name} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <Label htmlFor={`exam-${item.name}`}>{item.label}</Label>
                    <p className="text-xs text-muted-foreground">{item.hint}</p>
                  </div>
                  <Switch
                    id={`exam-${item.name}`}
                    checked={form.watch(item.name)}
                    onCheckedChange={(checked) => form.setValue(item.name, checked)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pilih soal</CardTitle>
              <CardDescription>
                Kumpulan soal ini menjadi pool. Jika acak soal aktif, sistem memilih sejumlah
                &quot;Jumlah soal diujikan&quot; secara acak saat siswa mulai.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QuestionPicker selected={selected} onChange={setSelected} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 p-5">
              <Button
                type="button"
                className="w-full"
                disabled={pending}
                onClick={() => void form.handleSubmit((values) => handleSave(values, true))()}
              >
                {pending ? <Loader2 className="animate-spin" /> : <Send />} Simpan & terbitkan
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Ujian terbit hanya bisa dikerjakan pada jadwal dan kelas yang sesuai.
              </p>
            </CardContent>
          </Card>
        </div>
      </form>

      <ExamPreviewDialog examId={id ?? null} open={previewOpen} onOpenChange={setPreviewOpen} />
    </div>
  );
}
