import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarContent } from './sidebar';
import { Topbar } from './topbar';
import { BackendBanner } from './backend-status';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-muted/30">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r lg:block">
        <SidebarContent />
      </aside>

      <div className="lg:pl-64">
        <Topbar onOpenMenu={() => setMenuOpen(true)} />
        <BackendBanner />
        <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-7">
          <Outlet />
        </main>
      </div>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent className="left-0 top-0 h-dvh w-72 max-w-[85vw] translate-x-0 translate-y-0 gap-0 rounded-none border-r p-0 duration-200">
          <DialogTitle className="sr-only">Menu navigasi</DialogTitle>
          <SidebarContent onNavigate={() => setMenuOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
