import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TemplateButtons({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" size={compact ? 'sm' : 'default'}>
        <a href="/templates/template-soal.xlsx" download>
          <FileSpreadsheet /> Template XLSX
        </a>
      </Button>
      <Button asChild variant="outline" size={compact ? 'sm' : 'default'}>
        <a href="/templates/template-soal.docx" download>
          <FileText /> Template DOCX
        </a>
      </Button>
    </div>
  );
}

export function DownloadHint() {
  return (
    <p className="text-xs text-muted-foreground">
      <Download className="mr-1 inline h-3 w-3" />
      Unduh template, isi sesuai kolom, lalu unggah kembali. Baris yang tidak valid akan ditolak dengan
      keterangan barisnya.
    </p>
  );
}
