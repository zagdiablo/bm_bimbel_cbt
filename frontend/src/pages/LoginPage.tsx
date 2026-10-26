import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Timer,
  WifiOff,
} from 'lucide-react';
import { env } from '@/lib/env';
import { deriveCredential } from '@/lib/password';
import { homeForRole } from '@/lib/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { errorMessage } from '@/lib/notify';
import { useGoogleLogin, useLogin } from '@/features/auth/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDocumentTitle } from '@/hooks/use-document-title';

const schema = z.object({
  email: z.string().trim().min(1, 'Email wajib diisi').email('Format email tidak valid'),
  password: z.string().min(1, 'Kata sandi wajib diisi'),
});

type FormValues = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@cbt.local', password: 'Admin#123' },
  { role: 'Guru', email: 'guru@cbt.local', password: 'Guru#123' },
  { role: 'Siswa', email: 'siswa@cbt.local', password: 'Siswa#123' },
];

function GoogleSignIn() {
  const containerRef = useRef<HTMLDivElement>(null);
  const googleLogin = useGoogleLogin();

  useEffect(() => {
    if (!env.googleClientId) return;
    let cancelled = false;

    const init = () => {
      if (cancelled || !window.google || !containerRef.current) return;
      window.google.accounts.id.initialize({
        client_id: env.googleClientId,
        callback: (response) => {
          if (response.credential) googleLogin.mutate(response.credential);
        },
      });
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        width: 320,
      });
    };

    if (window.google) {
      init();
    } else {
      const existing = document.querySelector<HTMLScriptElement>('script[data-cbt-gsi]');
      if (existing) {
        existing.addEventListener('load', init);
      } else {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.dataset.cbtGsi = 'true';
        script.addEventListener('load', init);
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">atau</span>
        </div>
      </div>
      <div ref={containerRef} className="flex justify-center" />
      {googleLogin.isPending ? (
        <p className="text-center text-xs text-muted-foreground">Memverifikasi akun Google...</p>
      ) : null}
    </div>
  );
}

export function LoginPage() {
  useDocumentTitle('Masuk');
  const user = useAuthStore((state) => state.user);
  const login = useLogin();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const [showPassword, setShowPassword] = useState(false);

  if (user) return <Navigate to={homeForRole(user.role)} replace />;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const credential = await deriveCredential(values.email, values.password);
      login.mutate({ email: values.email.trim().toLowerCase(), credential });
    } catch (error) {
      form.setError('password', { message: errorMessage(error) });
    }
  });

  const pending = login.isPending || form.formState.isSubmitting;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, white 0, transparent 40%), radial-gradient(circle at 80% 70%, white 0, transparent 35%)',
          }}
          aria-hidden
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
              <GraduationCap className="h-6 w-6" />
            </span>
            <div>
              <p className="text-lg font-bold leading-tight">{env.appName}</p>
              <p className="text-xs text-primary-foreground/70">Computer Based Test</p>
            </div>
          </div>
          <h1 className="mt-16 max-w-md text-3xl font-bold leading-snug">
            Ujian online yang rapi, aman, dan langsung ternilai.
          </h1>
          <p className="mt-3 max-w-md text-sm text-primary-foreground/80">
            Bank soal, pelaksanaan ujian dengan timer, penilaian otomatis, hingga rekap nilai PDF & Excel
            dalam satu aplikasi.
          </p>
        </div>
        <ul className="relative grid gap-4 text-sm">
          <li className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <span>Kunci jawaban tidak pernah dikirim ke perangkat siswa selama ujian berlangsung.</span>
          </li>
          <li className="flex items-start gap-3">
            <Timer className="mt-0.5 h-5 w-5 shrink-0" />
            <span>Timer tersinkron dengan server, jawaban tersimpan otomatis setiap beberapa detik.</span>
          </li>
          <li className="flex items-start gap-3">
            <WifiOff className="mt-0.5 h-5 w-5 shrink-0" />
            <span>Koneksi terputus? Jawaban lokal dipulihkan saat kembali online.</span>
          </li>
        </ul>
        <p className="relative text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} {env.appName}. Dibangun dengan React + Google Apps Script.
        </p>
      </section>

      <section className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-1 lg:hidden">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <GraduationCap className="h-5 w-5" />
              </span>
              <p className="text-lg font-bold">{env.appName}</p>
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight">Masuk ke akun Anda</h2>
            <p className="text-sm text-muted-foreground">
              Gunakan akun yang diberikan sekolah. Hubungi admin jika lupa kata sandi.
            </p>
          </div>

          {login.isError ? (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {errorMessage(login.error)}
            </div>
          ) : null}

          <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="nama@sekolah.sch.id"
                  className="pl-9"
                  aria-invalid={Boolean(form.formState.errors.email)}
                  {...form.register('email')}
                />
              </div>
              {form.formState.errors.email ? (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Kata sandi</Label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pl-9 pr-10"
                  aria-invalid={Boolean(form.formState.errors.password)}
                  {...form.register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.formState.errors.password ? (
                <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
              ) : null}
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {pending ? 'Memverifikasi...' : 'Masuk'}
            </Button>
          </form>

          {env.googleClientId ? <GoogleSignIn /> : null}

          {env.mockEnabled ? (
            <div className="rounded-xl border bg-muted/40 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Akun demo (mode lokal)
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => {
                      form.setValue('email', account.email, { shouldValidate: true });
                      form.setValue('password', account.password, { shouldValidate: true });
                      form.clearErrors();
                    }}
                    className="rounded-lg border bg-background px-2 py-2 text-left transition-colors hover:border-primary hover:bg-accent/50"
                  >
                    <span className="block text-xs font-semibold">{account.role}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{account.email}</span>
                    <span className="block text-[11px] text-muted-foreground">{account.password}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <p className="text-center text-xs text-muted-foreground">
            Dengan masuk, Anda menyetujui tata tertib ujian sekolah. Lupa kata sandi? Hubungi admin
            sekolah.
          </p>
        </div>
      </section>
    </div>
  );
}
