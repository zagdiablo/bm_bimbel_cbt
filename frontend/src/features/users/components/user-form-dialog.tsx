import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import type { Role, User } from '@/types/domain';
import type { UserInput } from '@/types/api';
import { deriveCredential } from '@/lib/password';
import { errorMessage } from '@/lib/notify';
import { useCreateUser, useUpdateUser } from '../queries';
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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const schema = z
  .object({
    name: z.string().trim().min(2, 'Nama minimal 2 karakter.'),
    email: z.string().trim().email('Format email tidak valid.'),
    role: z.enum(['admin', 'guru', 'siswa']),
    nis: z.string(),
    kelas: z.string(),
    active: z.boolean(),
    password: z.string(),
  })
  .superRefine((values, ctx) => {
    if (!values.password) return;
    if (values.password.length < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: 'Kata sandi minimal 8 karakter.',
      });
    }
  });

type FormValues = z.infer<typeof schema>;

function toFormValues(user?: User | null): FormValues {
  return {
    name: user?.name ?? '',
    email: user?.email ?? '',
    role: user?.role ?? 'siswa',
    nis: user?.nis ?? '',
    kelas: user?.kelas ?? '',
    active: user?.active ?? true,
    password: '',
  };
}

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User | null;
}

export function UserFormDialog({ open, onOpenChange, user }: UserFormDialogProps) {
  const create = useCreateUser();
  const update = useUpdateUser();
  const isEdit = Boolean(user);
  const pending = create.isPending || update.isPending;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(user),
  });

  const userId = user?.id ?? 'new';

  useEffect(() => {
    if (open) form.reset(toFormValues(user));
    // `form` is stable; only reset when the dialog opens or the target changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId]);

  const requiresPassword = !isEdit;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (isEdit && user) {
        const input: Partial<UserInput> = {
          name: values.name.trim(),
          email: values.email.trim().toLowerCase(),
          role: values.role as Role,
          nis: values.nis.trim(),
          kelas: values.kelas.trim(),
          active: values.active,
        };
        await update.mutateAsync({ id: user.id, input });
      } else {
        if (!values.password) {
          form.setError('password', { message: 'Kata sandi wajib diisi.' });
          return;
        }
        const credential = await deriveCredential(values.email, values.password);
        await create.mutateAsync({
          name: values.name.trim(),
          email: values.email.trim().toLowerCase(),
          role: values.role as Role,
          nis: values.nis.trim() || undefined,
          kelas: values.kelas.trim() || undefined,
          active: values.active,
          credential,
        });
      }
      onOpenChange(false);
    } catch (error) {
      form.setError('root', { message: errorMessage(error) });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit pengguna' : 'Tambah pengguna'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Perubahan email/role langsung berlaku pada sesi berikutnya.'
              : 'Kata sandi di-hash di browser sebelum dikirim; server tidak pernah menerima kata sandi asli.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void onSubmit(event)} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="user-name">Nama lengkap</Label>
            <Input id="user-name" {...form.register('name')} aria-invalid={Boolean(form.formState.errors.name)} />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="user-email">Email</Label>
            <Input id="user-email" type="email" autoComplete="off" {...form.register('email')} aria-invalid={Boolean(form.formState.errors.email)} />
            {form.formState.errors.email ? (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="user-role">Role</Label>
              <Select
                value={form.watch('role')}
                onValueChange={(value) => form.setValue('role', value as Role)}
              >
                <SelectTrigger id="user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="guru">Guru</SelectItem>
                  <SelectItem value="siswa">Siswa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-kelas">Kelas</Label>
              <Input id="user-kelas" placeholder="XII-IPA-1" {...form.register('kelas')} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="user-nis">NIS</Label>
              <Input id="user-nis" placeholder="2024001" {...form.register('nis')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-password">
                {requiresPassword ? 'Kata sandi awal' : 'Kata sandi baru (opsional)'}
              </Label>
              <Input
                id="user-password"
                type="password"
                autoComplete="new-password"
                placeholder={isEdit ? 'Kosongkan jika tidak diubah' : 'Minimal 8 karakter'}
                {...form.register('password')}
                aria-invalid={Boolean(form.formState.errors.password)}
              />
              {form.formState.errors.password ? (
                <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
              ) : null}
              {isEdit ? (
                <p className="text-xs text-muted-foreground">
                  Gunakan tombol &quot;Reset sandi&quot; pada tabel untuk mengganti kata sandi.
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="user-active">Akun aktif</Label>
              <p className="text-xs text-muted-foreground">Akun nonaktif tidak dapat masuk.</p>
            </div>
            <Switch
              id="user-active"
              checked={form.watch('active')}
              onCheckedChange={(checked) => form.setValue('active', checked)}
            />
          </div>

          {form.formState.errors.root ? (
            <p className="text-xs text-destructive">{form.formState.errors.root.message}</p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {pending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
