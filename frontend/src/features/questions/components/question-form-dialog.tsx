import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import type { QuestionInput } from '@/types/api';
import type { Difficulty, Question, QuestionType } from '@/types/domain';
import { OPTION_IDS, QUESTION_TYPES } from '@/lib/constants';
import { parseCsv } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateQuestion, useUpdateQuestion } from '../queries';

const schema = z
  .object({
    tipe: z.enum(['pg', 'pg_kompleks', 'benar_salah', 'isian', 'essay']),
    pertanyaan: z.string().trim().min(5, 'Pertanyaan minimal 5 karakter.'),
    gambarUrl: z.string().trim().url('URL gambar tidak valid.').or(z.literal('')),
    bobot: z.coerce.number().min(0.1, 'Bobot minimal 0,1.').max(100, 'Bobot maksimal 100.'),
    tingkat: z.enum(['mudah', 'sedang', 'sulit']),
    kategori: z.string().trim().min(1, 'Kategori wajib diisi.'),
    tags: z.string(),
    pembahasan: z.string(),
    aktif: z.boolean(),
    options: z.array(z.object({ id: z.string(), teks: z.string() })),
    kunciSelected: z.array(z.string()),
    kunciValue: z.boolean(),
    kunciAccepted: z.string(),
    kunciRubrik: z.string(),
  })
  .superRefine((values, ctx) => {
    const isChoice = values.tipe === 'pg' || values.tipe === 'pg_kompleks';
    if (isChoice) {
      const filled = values.options.filter((option) => option.teks.trim().length > 0);
      if (filled.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['options'],
          message: 'Minimal 2 opsi jawaban harus diisi.',
        });
      }
      if (values.kunciSelected.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['kunciSelected'],
          message: 'Pilih kunci jawaban.',
        });
      }
      if (values.tipe === 'pg' && values.kunciSelected.length > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['kunciSelected'],
          message: 'PG hanya boleh memiliki satu kunci.',
        });
      }
      for (const id of values.kunciSelected) {
        const option = filled.find((item) => item.id === id);
        if (!option) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['kunciSelected'],
            message: `Opsi ${id} masih kosong tetapi dipilih sebagai kunci.`,
          });
        }
      }
    }
    if (values.tipe === 'isian' && parseCsv(values.kunciAccepted.split('|').join(',')).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['kunciAccepted'],
        message: 'Isi minimal satu jawaban yang diterima.',
      });
    }
  });

type FormValues = z.infer<typeof schema>;

function toFormValues(question?: Question): FormValues {
  const options = OPTION_IDS.map((id) => {
    const existing = question?.options.find((option) => option.id === id);
    return { id, teks: existing?.teks ?? '' };
  });
  return {
    tipe: question?.tipe ?? 'pg',
    pertanyaan: question?.pertanyaan ?? '',
    gambarUrl: question?.gambarUrl ?? '',
    bobot: question?.bobot ?? 1,
    tingkat: question?.tingkat ?? 'sedang',
    kategori: question?.kategori ?? '',
    tags: question?.tags.join(', ') ?? '',
    pembahasan: question?.pembahasan ?? '',
    aktif: question?.aktif ?? true,
    options,
    kunciSelected: question?.kunci?.selected ?? [],
    kunciValue: question?.kunci?.value ?? true,
    kunciAccepted: question?.kunci?.accepted?.join(' | ') ?? '',
    kunciRubrik: question?.kunci?.rubrik ?? '',
  };
}

function toQuestionInput(values: FormValues): QuestionInput {
  const options =
    values.tipe === 'pg' || values.tipe === 'pg_kompleks'
      ? values.options
          .map((option) => ({ id: option.id, teks: option.teks.trim() }))
          .filter((option) => option.teks.length > 0)
      : [];

  return {
    tipe: values.tipe,
    pertanyaan: values.pertanyaan.trim(),
    gambarUrl: values.gambarUrl.trim() || undefined,
    options,
    kunci:
      values.tipe === 'pg' || values.tipe === 'pg_kompleks'
        ? { selected: values.kunciSelected }
        : values.tipe === 'benar_salah'
          ? { value: values.kunciValue }
          : values.tipe === 'isian'
            ? {
                accepted: values.kunciAccepted
                  .split('|')
                  .map((item) => item.trim())
                  .filter(Boolean),
              }
            : { rubrik: values.kunciRubrik.trim() || undefined },
    pembahasan: values.pembahasan.trim() || undefined,
    bobot: values.bobot,
    tingkat: values.tingkat,
    kategori: values.kategori.trim(),
    tags: parseCsv(values.tags),
    aktif: values.aktif,
  };
}

interface QuestionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question?: Question | null;
}

export function QuestionFormDialog({ open, onOpenChange, question }: QuestionFormDialogProps) {
  const create = useCreateQuestion();
  const update = useUpdateQuestion();
  const isEdit = Boolean(question);
  const pending = create.isPending || update.isPending;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(question ?? undefined),
  });

  const questionId = question?.id ?? 'new';

  useEffect(() => {
    if (open) form.reset(toFormValues(question ?? undefined));
    // `form` is stable; only reset on open/target change to avoid wiping edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, questionId]);

  const tipe = form.watch('tipe');
  const options = form.watch('options');
  const kunciSelected = form.watch('kunciSelected');
  const kunciValue = form.watch('kunciValue');
  const isChoice = tipe === 'pg' || tipe === 'pg_kompleks';

  const setKey = (id: string) => {
    if (tipe === 'pg') {
      form.setValue('kunciSelected', [id], { shouldValidate: true });
      return;
    }
    const current = form.getValues('kunciSelected');
    form.setValue(
      'kunciSelected',
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
      { shouldValidate: true },
    );
  };

  const onValid = (values: FormValues) => {
    const input = toQuestionInput(values);
    if (question) {
      update.mutate(
        { id: question.id, input },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      create.mutate(input, { onSuccess: () => onOpenChange(false) });
    }
  };

  const errors = form.formState.errors;
  const arrayError = errors.options as
    | { message?: string; root?: { message?: string } }
    | undefined;
  const optionsError = arrayError?.message ?? arrayError?.root?.message;
  const keyError = errors.kunciSelected as { message?: string } | undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit soal' : 'Tambah soal'}</DialogTitle>
          <DialogDescription>
            Kunci jawaban hanya dikirim ke guru/admin dan tidak pernah disertakan saat siswa mengerjakan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void form.handleSubmit(onValid)(event)} className="space-y-5" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="q-tipe">Tipe soal</Label>
              <Select
                value={tipe}
                onValueChange={(value) => {
                  form.setValue('tipe', value as QuestionType, { shouldValidate: true });
                  form.setValue('kunciSelected', []);
                }}
              >
                <SelectTrigger id="q-tipe">
                  <SelectValue placeholder="Pilih tipe" />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-kategori">Kategori / mapel</Label>
              <Input id="q-kategori" placeholder="Matematika" {...form.register('kategori')} aria-invalid={Boolean(errors.kategori)} />
              {errors.kategori ? <p className="text-xs text-destructive">{errors.kategori.message}</p> : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="q-pertanyaan">Pertanyaan</Label>
            <Textarea
              id="q-pertanyaan"
              rows={4}
              placeholder="Tulis pertanyaan. Gunakan baris baru untuk daftar."
              {...form.register('pertanyaan')}
              aria-invalid={Boolean(errors.pertanyaan)}
            />
            {errors.pertanyaan ? <p className="text-xs text-destructive">{errors.pertanyaan.message}</p> : null}
          </div>

          {isChoice ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Opsi jawaban</legend>
              <p className="text-xs text-muted-foreground">
                Kosongkan opsi yang tidak dipakai. Klik huruf di kanan untuk menandai kunci.
              </p>
              <div className="space-y-2">
                {options.map((option, index) => {
                  const selected = kunciSelected.includes(option.id);
                  return (
                    <div key={option.id} className="flex items-center gap-2">
                      <span className="w-6 text-sm font-semibold text-muted-foreground">{option.id}.</span>
                      <Input
                        value={option.teks}
                        onChange={(event) => {
                          form.setValue(`options.${index}.teks`, event.target.value, { shouldValidate: true });
                          if (!event.target.value.trim()) {
                            form.setValue(
                              'kunciSelected',
                              form.getValues('kunciSelected').filter((id) => id !== option.id),
                            );
                          }
                        }}
                        placeholder={`Opsi ${option.id}`}
                        aria-label={`Teks opsi ${option.id}`}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant={selected ? 'default' : 'outline'}
                        aria-pressed={selected}
                        onClick={() => setKey(option.id)}
                        className="w-20 shrink-0"
                      >
                        {selected ? 'Kunci' : 'Pilih'}
                      </Button>
                    </div>
                  );
                })}
              </div>
              {optionsError ? <p className="text-xs text-destructive">{optionsError}</p> : null}
              {keyError?.message ? (
                <p className="text-xs text-destructive">{keyError.message}</p>
              ) : null}
            </fieldset>
          ) : null}

          {tipe === 'benar_salah' ? (
            <div className="space-y-2">
              <Label>Kunci jawaban</Label>
              <div className="flex gap-2">
                {[true, false].map((value) => (
                  <Button
                    key={String(value)}
                    type="button"
                    variant={kunciValue === value ? 'default' : 'outline'}
                    onClick={() => form.setValue('kunciValue', value, { shouldValidate: true })}
                    aria-pressed={kunciValue === value}
                    className="flex-1"
                  >
                    {value ? 'Benar' : 'Salah'}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {tipe === 'isian' ? (
            <div className="space-y-1.5">
              <Label htmlFor="q-accepted">Jawaban diterima</Label>
              <Input
                id="q-accepted"
                placeholder="jakarta | dki jakarta"
                {...form.register('kunciAccepted')}
                aria-invalid={Boolean(errors.kunciAccepted)}
              />
              <p className="text-xs text-muted-foreground">
                Pisahkan varian jawaban dengan tanda <code>|</code>. Pencocokan mengabaikan huruf
                besar/kecil, spasi ganda, dan tanda baca.
              </p>
              {errors.kunciAccepted ? (
                <p className="text-xs text-destructive">{errors.kunciAccepted.message}</p>
              ) : null}
            </div>
          ) : null}

          {tipe === 'essay' ? (
            <div className="space-y-1.5">
              <Label htmlFor="q-rubrik">Rubrik penilaian (opsional)</Label>
              <Textarea
                id="q-rubrik"
                rows={3}
                placeholder="Panduan singkat untuk guru saat menilai jawaban."
                {...form.register('kunciRubrik')}
              />
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="q-bobot">Bobot</Label>
              <Input id="q-bobot" type="number" step="0.5" min="0.1" {...form.register('bobot')} aria-invalid={Boolean(errors.bobot)} />
              {errors.bobot ? <p className="text-xs text-destructive">{errors.bobot.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-tingkat">Tingkat</Label>
              <Select
                value={form.watch('tingkat')}
                onValueChange={(value) => form.setValue('tingkat', value as Difficulty)}
              >
                <SelectTrigger id="q-tingkat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mudah">Mudah</SelectItem>
                  <SelectItem value="sedang">Sedang</SelectItem>
                  <SelectItem value="sulit">Sulit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-tags">Tag</Label>
              <Input id="q-tags" placeholder="aljabar, pangkat" {...form.register('tags')} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="q-gambar">URL gambar (opsional)</Label>
              <Input id="q-gambar" placeholder="https://..." {...form.register('gambarUrl')} aria-invalid={Boolean(errors.gambarUrl)} />
              {errors.gambarUrl ? <p className="text-xs text-destructive">{errors.gambarUrl.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-pembahasan">Pembahasan (opsional)</Label>
              <Input id="q-pembahasan" placeholder="Ditampilkan bila guru mengizinkan." {...form.register('pembahasan')} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="q-aktif">Soal aktif</Label>
              <p className="text-xs text-muted-foreground">Soal nonaktif tidak muncul di bank soal.</p>
            </div>
            <Switch
              id="q-aktif"
              checked={form.watch('aktif')}
              onCheckedChange={(checked) => form.setValue('aktif', checked)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {pending ? 'Menyimpan...' : 'Simpan soal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
