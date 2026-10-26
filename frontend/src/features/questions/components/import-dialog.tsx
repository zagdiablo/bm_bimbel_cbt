import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Loader2, Upload } from 'lucide-react';
import type { QuestionInput } from '@/types/api';
import { api } from '@/lib/api';
import { errorMessage, toastError, toastSuccess } from '@/lib/notify';
import { parseQuestionDocx } from '@/lib/parse-docx';
import { parseQuestionWorkbook } from '@/lib/parse-xlsx';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileDropzone } from '@/components/common/file-dropzone';
import { LoadingState } from '@/components/common/loading-state';
import { TemplateButtons, DownloadHint } from './template-buttons';

type Mode = 'xlsx' | 'docx';
type ImportRow = QuestionInput & { sourceRow: number };
interface ImportResult {
  rows: ImportRow[];
  errors: { row: number; message: string }[];
}

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CHUNK_SIZE = 50;

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const [mode, setMode] = useState<Mode>('xlsx');
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<{ row: number; message: string }[]>([]);
  const [importing, setImporting] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    if (!file) {
      setResult(null);
      setParseError(null);
      setParsing(false);
      return;
    }
    setParsing(true);
    setResult(null);
    setParseError(null);
    setServerErrors([]);
    const task =
      mode === 'xlsx' ? parseQuestionWorkbook(file) : parseQuestionDocx(file);
    task
      .then((parsed) => {
        if (cancelled) return;
        setResult({ rows: parsed.rows, errors: parsed.errors });
      })
      .catch((error: unknown) => {
        if (!cancelled) setParseError(errorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setParsing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [file, mode]);

  const reset = () => {
    setFile(null);
    setResult(null);
    setParseError(null);
    setServerErrors([]);
  };

  const handleImport = async () => {
    if (!result || result.rows.length === 0) return;
    setImporting(true);
    setServerErrors([]);
    let created = 0;
    const failures: { row: number; message: string }[] = [];

    for (let start = 0; start < result.rows.length; start += CHUNK_SIZE) {
      const chunk = result.rows.slice(start, start + CHUNK_SIZE);
      try {
        const response = await api.questions.bulkCreate(chunk);
        created += response.created;
        for (const issue of response.errors) {
          failures.push({
            row: chunk[issue.index]?.sourceRow ?? start + issue.index + 1,
            message: issue.message,
          });
        }
      } catch (error) {
        failures.push({ row: 0, message: errorMessage(error) });
        break;
      }
    }

    setServerErrors(failures);
    setImporting(false);
    await queryClient.invalidateQueries({ queryKey: ['questions'] });
    if (created > 0) {
      toastSuccess(`${created} soal berhasil ditambahkan`);
    }
    if (failures.length === 0) {
      toastSuccess('Import selesai', 'Semua baris berhasil disimpan.');
      onOpenChange(false);
      reset();
    } else if (created === 0) {
      toastError(new Error(failures[0]?.message ?? 'Tidak ada soal yang tersimpan.'), 'Import gagal');
    }
  };

  const validCount = result?.rows.length ?? 0;
  const invalidCount = (result?.errors.length ?? 0) + serverErrors.length;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import bank soal</DialogTitle>
          <DialogDescription>
            Unggah file sesuai template. Sistem memvalidasi setiap baris sebelum menyimpan.
          </DialogDescription>
        </DialogHeader>

        <TemplateButtons compact />
        <DownloadHint />

        <Tabs
          value={mode}
          onValueChange={(value) => {
            setMode(value as Mode);
            reset();
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="xlsx">Excel (.xlsx)</TabsTrigger>
            <TabsTrigger value="docx">Word (.docx)</TabsTrigger>
          </TabsList>

          <TabsContent value="xlsx" className="space-y-3">
            <FileDropzone
              accept=".xlsx,.xls"
              file={file}
              onFile={setFile}
              hint="Format .xlsx dengan sheet bernama Soal (atau sheet pertama)."
              disabled={parsing || importing}
            />
            <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              Kolom: <code>no, tipe, pertanyaan, opsi_a…opsi_e, kunci, bobot, kategori</code>.
              Kolom opsional: <code>tingkat, tags, pembahasan, gambar</code>. Kunci PG kompleks
              dipisah koma (contoh: <code>A,C</code>).
            </p>
          </TabsContent>

          <TabsContent value="docx" className="space-y-3">
            <FileDropzone
              accept=".docx"
              file={file}
              onFile={setFile}
              hint="Format .docx mengikuti docs/IMPORT_FORMAT.md."
              disabled={parsing || importing}
            />
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Contoh format baku:</p>
              <pre className="mt-1 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">{`1. [PG] Hasil 2^5 adalah ...
A. 16
B. 32
C. 64
Kunci: B
Bobot: 1
Kategori: Matematika
Tingkat: mudah
Tags: eksponen

2. [ESSAY] Jelaskan langkah ...
Kunci: Rubrik penilaian
Bobot: 5
Kategori: Matematika`}</pre>
            </div>
          </TabsContent>
        </Tabs>

        {parsing ? <LoadingState label="Membaca dan memvalidasi file..." /> : null}

        {parseError ? (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{parseError}</span>
          </div>
        ) : null}

        {!parsing && result ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> {validCount} valid
              </Badge>
              {result.errors.length > 0 || serverErrors.length > 0 ? (
                <Badge variant="danger" className="gap-1">
                  <AlertTriangle className="h-3 w-3" /> {invalidCount} bermasalah
                </Badge>
              ) : null}
              <span className="text-xs text-muted-foreground">
                Hanya baris valid yang akan dikirim ke server.
              </span>
            </div>

            {validCount > 0 ? (
              <div className="max-h-56 overflow-y-auto rounded-lg border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-muted/80 text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5">Baris</th>
                      <th className="px-2 py-1.5">Tipe</th>
                      <th className="px-2 py-1.5">Pertanyaan</th>
                      <th className="px-2 py-1.5">Kunci</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.slice(0, 12).map((row, index) => (
                      <tr key={`${row.sourceRow}-${index}`} className="border-t">
                        <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{row.sourceRow}</td>
                        <td className="px-2 py-1.5">{row.tipe}</td>
                        <td className="max-w-[18rem] truncate px-2 py-1.5">{row.pertanyaan}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {row.kunci.selected?.join(', ') ??
                            (typeof row.kunci.value === 'boolean'
                              ? row.kunci.value
                                ? 'Benar'
                                : 'Salah'
                              : row.kunci.accepted?.join(' / ') ?? 'rubrik')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {validCount > 12 ? (
                  <p className="border-t px-2 py-1.5 text-[11px] text-muted-foreground">
                    +{validCount - 12} baris lainnya
                  </p>
                ) : null}
              </div>
            ) : null}

            {result.errors.length > 0 ? (
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                {result.errors.map((issue, index) => (
                  <p key={`${issue.row}-${index}`}>
                    <strong>Baris {issue.row || '-'}:</strong> {issue.message}
                  </p>
                ))}
              </div>
            ) : null}

            {serverErrors.length > 0 ? (
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                {serverErrors.map((issue, index) => (
                  <p key={`server-${issue.row}-${index}`}>
                    <strong>Baris {issue.row || '-'}:</strong> {issue.message}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Tutup
          </Button>
          <Button onClick={() => void handleImport()} disabled={importing || parsing || validCount === 0}>
            {importing ? <Loader2 className="animate-spin" /> : <Upload />}
            {importing ? 'Mengimpor...' : `Impor ${validCount} soal`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
