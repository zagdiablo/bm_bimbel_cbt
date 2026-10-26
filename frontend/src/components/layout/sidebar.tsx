import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { GraduationCap, LogOut, X } from 'lucide-react';
import { NAV_BY_ROLE } from '@/lib/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api';
import { env } from '@/lib/env';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { RoleBadge } from '@/components/common/status-badges';

interface SidebarContentProps {
  onNavigate?: () => void;
}

export function SidebarContent({ onNavigate }: SidebarContentProps) {
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  if (!user) return null;
  const items = NAV_BY_ROLE[user.role];

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await api.auth.logout();
    } catch {
      // Even if the server call fails, drop the local session.
    } finally {
      clearSession();
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <GraduationCap className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight">{env.appName}</p>
          <p className="text-[11px] text-muted-foreground">Computer Based Test</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Navigasi utama">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            <item.icon className="h-4 w-4" aria-hidden />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-3 border-t p-3">
        {env.mockEnabled ? (
          <div className="rounded-lg border border-dashed bg-muted/40 px-3 py-2">
            <p className="text-xs font-semibold">Mode demo lokal</p>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Data disimpan di browser. Isi VITE_GAS_API_URL untuk memakai Google Sheets.
            </p>
          </div>
        ) : null}
        <div className="rounded-lg bg-muted/50 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <RoleBadge role={user.role} />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
          >
            <LogOut /> {loggingOut ? 'Keluar...' : 'Keluar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon-sm" onClick={onClick} aria-label="Tutup menu">
      <X />
    </Button>
  );
}
