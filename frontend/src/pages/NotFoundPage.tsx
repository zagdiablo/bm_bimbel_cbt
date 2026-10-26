import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/hooks/use-document-title';

export function NotFoundPage() {
  useDocumentTitle('Halaman tidak ditemukan');
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Compass className="h-8 w-8 text-muted-foreground" />
      </span>
      <div className="space-y-1">
        <p className="text-3xl font-bold">404</p>
        <h1 className="text-lg font-semibold">Halaman tidak ditemukan</h1>
        <p className="text-sm text-muted-foreground">
          Tautan yang Anda buka mungkin sudah dipindahkan atau tidak tersedia.
        </p>
      </div>
      <Button asChild>
        <Link to="/">Kembali ke beranda</Link>
      </Button>
    </div>
  );
}
