import { useEffect, useState } from 'react';
import { Building2, ImageIcon, Loader2, Save, ServerCog } from 'lucide-react';
import type { SchoolSettings } from '@/types/domain';
import { env } from '@/lib/env';
import { toastSuccess } from '@/lib/notify';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useSettings, useUpdateSettings } from '@/features/dashboard/queries';
import { PageHeader } from '@/components/common/page-header';
import { ErrorState } from '@/components/common/error-state';
import { LoadingState } from '@/components/common/loading-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const EMPTY: SchoolSettings = {
  schoolName: '',
  schoolAddress: '',
  schoolLogoUrl: '',
  schoolHeadmaster: '',
};

export function SettingsPage() {
  useDocumentTitle('Pengaturan');
  const settings = useSettings();
  const update = useUpdateSettings();
  const [form, setForm] = useState<SchoolSettings>(EMPTY);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    if (settings.data) {
      setForm(settings.data.settings);
      setLogoError(false);
    }
  }, [settings.data]);

  const submit = async () => {
    if (!form.schoolName.trim()) return;
    await update.mutateAsync({
      ...form,
      schoolName: form.schoolName.trim(),
      schoolAddress: form.schoolAddress.trim(),
      schoolLogoUrl: form.schoolLogoUrl.trim(),
      schoolHeadmaster: form.schoolHeadmaster.trim(),
    });
    toastSuccess('Pengaturan disimpan', 'Kop laporan PDF/XLSX akan memakai data ini.');
  };

  if (settings.isPending) return <LoadingState label="Memuat pengaturan..." />;
  if (settings.isError) {
    return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pengaturan Sekolah"
        description="Identitas sekolah untuk kop laporan hasil ujian (PDF & Excel)."
      />

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Identitas sekolah
            </CardTitle>
            <CardDescription>Data ini disimpan di Script Properties backend GAS.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="school-name">Nama sekolah</Label>
              <Input
                id="school-name"
                value={form.schoolName}
                onChange={(event) => setForm((current) => ({ ...current, schoolName: event.target.value }))}
                placeholder="SMA Negeri 1 Contoh"
                aria-invalid={!form.schoolName.trim()}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="school-address">Alamat</Label>
              <Input
                id="school-address"
                value={form.schoolAddress}
                onChange={(event) => setForm((current) => ({ ...current, schoolAddress: event.target.value }))}
                placeholder="Jl. Pendidikan No. 1, Jakarta"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="school-headmaster">Kepala sekolah</Label>
                <Input
                  id="school-headmaster"
                  value={form.schoolHeadmaster}
                  onChange={(event) => setForm((current) => ({ ...current, schoolHeadmaster: event.target.value }))}
                  placeholder="Drs. Nama, M.Pd."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="school-logo">URL logo</Label>
                <Input
                  id="school-logo"
                  value={form.schoolLogoUrl}
                  onChange={(event) => {
                    setLogoError(false);
                    setForm((current) => ({ ...current, schoolLogoUrl: event.target.value }));
                  }}
                  placeholder="https://.../logo.png"
                />
              </div>
            </div>

            <div className="rounded-lg border border-dashed p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Pratinjau kop
              </p>
              <div className="mt-2 flex items-center gap-3">
                {form.schoolLogoUrl && !logoError ? (
                  <img
                    src={form.schoolLogoUrl}
                    alt="Logo sekolah"
                    className="h-12 w-12 rounded object-contain"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded bg-muted">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold">{form.schoolName || 'Nama sekolah'}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {form.schoolAddress || 'Alamat sekolah'}
                  </p>
                  {form.schoolHeadmaster ? (
                    <p className="text-[11px] text-muted-foreground">Kepala: {form.schoolHeadmaster}</p>
                  ) : null}
                </div>
              </div>
              {logoError ? (
                <p className="mt-2 text-xs text-warning">
                  Logo tidak dapat dimuat (CORS/URL). PDF akan dicetak tanpa logo.
                </p>
              ) : null}
            </div>

            <Button onClick={() => void submit()} disabled={update.isPending || !form.schoolName.trim()}>
              {update.isPending ? <Loader2 className="animate-spin" /> : <Save />} Simpan pengaturan
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ServerCog className="h-4 w-4 text-primary" /> Informasi backend
            </CardTitle>
            <CardDescription>Konfigurasi aktif pada build ini.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Mode data</span>
              <Badge variant={env.mockEnabled ? 'warning' : 'success'}>
                {env.mockEnabled ? 'Mock localStorage' : 'Google Apps Script'}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Nama aplikasi</p>
              <p className="font-medium">{env.appName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">URL GAS</p>
              <p className="break-all font-mono text-xs">
                {env.gasApiUrl || 'Belum diisi (VITE_GAS_API_URL kosong)'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Google OAuth</p>
              <p className="font-medium">{env.googleClientId ? 'Aktif' : 'Tidak dikonfigurasi'}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
              Untuk produksi, isi <code>VITE_GAS_API_URL</code> dengan URL deployment Web App yang
              diakhiri <code>/exec</code>, lalu deploy ulang frontend. Data demo di localStorage tidak
              ikut terkirim.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
