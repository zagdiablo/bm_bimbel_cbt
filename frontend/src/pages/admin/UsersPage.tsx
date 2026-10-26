import { useMemo, useState } from 'react';
import { KeyRound, Loader2, MoreHorizontal, Pencil, Plus, Trash2, UserCog, Users } from 'lucide-react';
import type { Role, User } from '@/types/domain';
import { ROLE_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { deriveCredential } from '@/lib/password';
import { toastError, toastSuccess } from '@/lib/notify';
import { useDebounce } from '@/hooks/use-debounce';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useAuthStore } from '@/stores/auth-store';
import { useDeleteUser, useResetPassword, useUsers } from '@/features/users/queries';
import { UserFormDialog } from '@/features/users/components/user-form-dialog';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { TableSkeleton } from '@/components/common/loading-state';
import { Pagination } from '@/components/common/pagination';
import { SearchInput } from '@/components/common/search-input';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { RoleBadge } from '@/components/common/status-badges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

interface ResetTarget {
  user: User;
  password: string;
}

export function UsersPage() {
  useDocumentTitle('Pengguna');
  const me = useAuthStore((state) => state.user);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [resetTarget, setResetTarget] = useState<ResetTarget | null>(null);
  const [resetting, setResetting] = useState(false);

  const debouncedQuery = useDebounce(query, 400);
  const filters = useMemo(
    () => ({ q: debouncedQuery, role, page, pageSize: 20 }),
    [debouncedQuery, role, page],
  );
  const users = useUsers(filters);
  const remove = useDeleteUser();
  const reset = useResetPassword();

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const submitReset = async () => {
    if (!resetTarget) return;
    if (resetTarget.password.length < 8) {
      toastError(new Error('Kata sandi minimal 8 karakter.'), 'Validasi');
      return;
    }
    setResetting(true);
    try {
      const credential = await deriveCredential(resetTarget.user.email, resetTarget.password);
      await reset.mutateAsync({ id: resetTarget.user.id, credential });
      toastSuccess('Kata sandi direset', 'Minta pengguna segera menggantinya.');
      setResetTarget(null);
    } catch (error) {
      toastError(error, 'Gagal reset kata sandi');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Manajemen Pengguna"
        description="Kelola akun admin, guru, dan siswa beserta kelasnya."
        actions={
          <Button onClick={openCreate}>
            <Plus /> Tambah pengguna
          </Button>
        }
      />

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-[1.6fr_1fr]">
            <SearchInput
              value={query}
              onChange={(value) => {
                setQuery(value);
                setPage(1);
              }}
              placeholder="Cari nama, email, NIS, atau kelas..."
            />
            <Select
              value={role || 'all'}
              onValueChange={(value) => {
                setRole(value === 'all' ? '' : (value as Role));
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Filter role">
                <SelectValue placeholder="Semua role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua role</SelectItem>
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {users.isPending ? (
            <TableSkeleton rows={6} columns={4} />
          ) : users.isError ? (
            <ErrorState error={users.error} onRetry={() => void users.refetch()} />
          ) : users.data.items.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Tidak ada pengguna"
              description="Ubah filter pencarian atau tambahkan akun baru."
              action={
                <Button onClick={openCreate}>
                  <Plus /> Tambah pengguna
                </Button>
              }
            />
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {users.data.items.map((user) => (
                  <div key={user.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{user.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                      <RoleBadge role={user.role} />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        {user.nis || '-'} • {user.kelas || '-'}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Aksi ${user.name}`}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => {
                              setEditing(user);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setResetTarget({ user, password: '' })}>
                            <KeyRound /> Reset sandi
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            destructive
                            disabled={user.id === me?.id}
                            onSelect={() => setDeleting(user)}
                          >
                            <Trash2 /> Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {!user.active ? (
                      <Badge variant="outline" className="mt-2">
                        Nonaktif
                      </Badge>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pengguna</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>NIS / Kelas</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Dibuat</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.data.items.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </TableCell>
                        <TableCell>
                          <RoleBadge role={user.role} />
                        </TableCell>
                        <TableCell className="text-xs">
                          <p>{user.nis || '-'}</p>
                          <p className="text-muted-foreground">{user.kelas || '-'}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.active ? 'success' : 'outline'}>
                            {user.active ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDate(user.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label={`Aksi ${user.name}`}>
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() => {
                                  setEditing(user);
                                  setFormOpen(true);
                                }}
                              >
                                <Pencil /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => setResetTarget({ user, password: '' })}>
                                <KeyRound /> Reset sandi
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                destructive
                                disabled={user.id === me?.id}
                                onSelect={() => setDeleting(user)}
                              >
                                <Trash2 /> Hapus
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Pagination
                page={users.data.page}
                pageSize={users.data.pageSize}
                total={users.data.total}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} user={editing} />

      <Dialog
        open={Boolean(resetTarget)}
        onOpenChange={(open) => {
          if (!open) setResetTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-4 w-4" /> Reset kata sandi
            </DialogTitle>
            <DialogDescription>
              Kata sandi baru untuk <strong>{resetTarget?.user.name}</strong>. Sampaikan secara
              pribadi; semua sesi lama akan otomatis berakhir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reset-password">Kata sandi baru</Label>
            <Input
              id="reset-password"
              type="text"
              value={resetTarget?.password ?? ''}
              onChange={(event) =>
                setResetTarget((current) =>
                  current ? { ...current, password: event.target.value } : current,
                )
              }
              placeholder="Minimal 8 karakter"
              className="font-mono"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)} disabled={resetting}>
              Batal
            </Button>
            <Button onClick={() => void submitReset()} disabled={resetting}>
              {resetting ? <Loader2 className="animate-spin" /> : <KeyRound />} Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Hapus pengguna?"
        description={
          <span>
            Akun <strong>{deleting?.name}</strong> ({deleting?.email}) akan dihapus permanen. Data
            pengerjaan ujian tetap tersimpan.
          </span>
        }
        confirmLabel="Hapus pengguna"
        pending={remove.isPending}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </div>
  );
}
