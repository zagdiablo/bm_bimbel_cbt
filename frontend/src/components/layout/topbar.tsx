import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Bug, KeyRound, LogOut, Menu, RefreshCcw, ShieldAlert } from 'lucide-react';
import { NAV_BY_ROLE } from '@/lib/navigation';
import { env } from '@/lib/env';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api';
import { deriveCredential } from '@/lib/password';
import { simulateNextError } from '@/lib/mock/handler';
import { resetDb } from '@/lib/mock/db';
import { toastError, toastSuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HealthIndicator } from './backend-status';
import { RoleBadge } from '@/components/common/status-badges';

function usePageTitle(): string {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  if (!user) return '';
  const items = NAV_BY_ROLE[user.role];
  const match = items
    .filter((item) => (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)))
    .sort((a, b) => b.to.length - a.to.length)[0];
  return match?.label ?? env.appName;
}

function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (value: boolean) => void }) {
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (!user) return;
    if (next.length < 8) {
      toastError(new Error('Kata sandi baru minimal 8 karakter.'), 'Validasi');
      return;
    }
    if (next !== confirm) {
      toastError(new Error('Konfirmasi kata sandi tidak sama.'), 'Validasi');
      return;
    }
    setPending(true);
    try {
      const [currentCredential, newCredential] = await Promise.all([
        deriveCredential(user.email, current),
        deriveCredential(user.email, next),
      ]);
      await api.auth.changePassword(currentCredential, newCredential);
      toastSuccess('Kata sandi diperbarui', 'Silakan masuk kembali dengan kata sandi baru.');
      onOpenChange(false);
      clearSession();
      navigate('/login', { replace: true });
    } catch (error) {
      toastError(error, 'Gagal mengganti kata sandi');
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ganti kata sandi</DialogTitle>
          <DialogDescription>
            Kata sandi di-hash di perangkat Anda (PBKDF2 100.000 iterasi) sebelum dikirim ke server.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Kata sandi saat ini</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Kata sandi baru</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Ulangi kata sandi baru</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Batal
          </Button>
          <Button onClick={() => void submit()} disabled={pending}>
            <KeyRound /> {pending ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const title = usePageTitle();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await api.auth.logout();
    } catch {
      // Local session is cleared even if the network call fails.
    } finally {
      clearSession();
      navigate('/login', { replace: true });
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onOpenMenu}
          aria-label="Buka menu navigasi"
        >
          <Menu />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold sm:text-lg">{title}</p>
        </div>
        <HealthIndicator />
        {env.mockEnabled ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="Alat demo">
                <Bug />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Alat mode demo</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() => {
                  simulateNextError();
                  toastSuccess('Error disimulasikan', 'Permintaan API berikutnya akan gagal (500).');
                }}
              >
                <ShieldAlert /> Simulasi error server
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  resetDb();
                  queryClient.clear();
                  toastSuccess('Data demo direset', 'Muat ulang halaman untuk melihat data awal.');
                }}
              >
                <RefreshCcw /> Reset data demo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/login">Kembali ke halaman login</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-10 gap-2 px-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden max-w-[10rem] truncate text-sm sm:block">{user.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span className="truncate normal-case">{user.email}</span>
                <RoleBadge role={user.role} />
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setPasswordOpen(true)}>
                <KeyRound /> Ganti kata sandi
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => void handleLogout()}
                disabled={loggingOut}
                className="text-muted-foreground"
              >
                <LogOut /> {loggingOut ? 'Keluar...' : 'Keluar dari akun'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </header>
  );
}
