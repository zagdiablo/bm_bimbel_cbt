import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/hooks/use-document-title';

export function UnauthorizedPage() {
  useDocumentTitle('Akses ditolak');
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <ShieldAlert className="h-8 w-8 text-destructive" />
      </span>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Akses ditolak</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Akun Anda tidak memiliki izin untuk membuka halaman ini.
        </p>
      </div>
      <Button asChild>
        <Link to="/">Kembali ke dashboard</Link>
      </Button>
    </div>
  );
}
