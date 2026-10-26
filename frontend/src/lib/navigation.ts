import {
  Activity,
  BarChart3,
  ClipboardList,
  FileCheck2,
  History,
  LayoutDashboard,
  Library,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/types/domain';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export function homeForRole(role: Role): string {
  return role === 'admin' ? '/admin' : role === 'guru' ? '/guru' : '/siswa';
}

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  admin: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/pengguna', label: 'Pengguna', icon: Users },
    { to: '/admin/statistik', label: 'Statistik', icon: BarChart3 },
    { to: '/admin/aktivitas', label: 'Aktivitas', icon: Activity },
    { to: '/admin/pengaturan', label: 'Pengaturan', icon: Settings },
  ],
  guru: [
    { to: '/guru', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/guru/bank-soal', label: 'Bank Soal', icon: Library },
    { to: '/guru/ujian', label: 'Ujian', icon: ClipboardList },
    { to: '/guru/hasil', label: 'Hasil & Penilaian', icon: FileCheck2 },
    { to: '/guru/statistik', label: 'Statistik', icon: BarChart3 },
  ],
  siswa: [
    { to: '/siswa', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/siswa/ujian', label: 'Ujian Saya', icon: ClipboardList },
    { to: '/siswa/hasil', label: 'Riwayat Nilai', icon: History },
  ],
};
