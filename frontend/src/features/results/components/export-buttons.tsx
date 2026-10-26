import { useState } from 'react';
import { FileDown, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { exportRecapPdf } from '@/lib/export-pdf';
import { exportRecapXlsx } from '@/lib/export-xlsx';
import { toastError, toastSuccess } from '@/lib/notify';import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ExportButtons({ examId, disabled }: { examId: string | null; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);

  const run = async (kind: 'pdf' | 'xlsx') => {
    if (!examId) return;
    setBusy(true);
    try {
      const payload = await api.results.exportData(examId);
      if (payload.rows.length === 0) {
        toastError(new Error('Belum ada peserta yang menyelesaikan ujian ini.'), 'Tidak ada data');
        return;
      }
      if (kind === 'pdf') await exportRecapPdf(payload);
      else await exportRecapXlsx(payload);
      toastSuccess(kind === 'pdf' ? 'Rekap PDF dibuat' : 'Rekap Excel dibuat');
    } catch (error) {
      toastError(error, `Gagal membuat ${kind.toUpperCase()}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled || busy || !examId}>
          {busy ? <Loader2 className="animate-spin" /> : <FileDown />} Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Format laporan</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => void run('pdf')}>
          <FileText /> PDF rekap kelas
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void run('xlsx')}>
          <FileSpreadsheet /> Excel rekap nilai
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
