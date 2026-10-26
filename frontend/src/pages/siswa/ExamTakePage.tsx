import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  LayoutGrid,
  Loader2,
  LockKeyhole,
  Maximize,
  Send,
  ShieldAlert,
  WifiOff,
} from 'lucide-react';
import type { AttemptPayload } from '@/types/domain';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import { cn, formatClock, formatDateTime, formatDuration } from '@/lib/utils';
import { hasAnswer } from '@/lib/constants';
import { errorMessage, toastError } from '@/lib/notify';
import { useDocumentTitle } from '@/hooks/use-document-title';
import {
  clearAttemptDraft,
  pendingAnswerPayload,
  useAttemptStore,
} from '@/stores/attempt-store';
import { useAutosave } from '@/features/attempt/hooks/use-autosave';
import { useExamTimer } from '@/features/attempt/hooks/use-exam-timer';
import { requestFullscreen, useAntiCheat } from '@/features/attempt/hooks/use-anti-cheat';
import { QuestionCard } from '@/features/attempt/components/question-card';
import { QuestionNavigator } from '@/features/attempt/components/question-navigator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageLoader } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';

const WARNING_COPY: Record<string, string> = {
  tab_switch: 'Anda meninggalkan halaman ujian. Aktivitas ini tercatat.',
  fullscreen_exit: 'Mode layar penuh dinonaktifkan. Tetap fokus pada ujian.',
  copy: 'Menyalin teks dinonaktifkan selama ujian.',
  paste: 'Menempel teks dinonaktifkan selama ujian.',
};

function ExamSession({ initial }: { initial: AttemptPayload }) {
  const navigate = useNavigate();
  const submission = initial.submission;
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(initial.remainingSec);
  const [warnings, setWarnings] = useState(submission.tabSwitchCount);
  const [warningBanner, setWarningBanner] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const answers = useAttemptStore((state) => state.answers);
  const ragu = useAttemptStore((state) => state.ragu);
  const pendingCount = useAttemptStore((state) => Object.keys(state.pending).length);
  const lastSavedAt = useAttemptStore((state) => state.lastSavedAt);

  useDocumentTitle(`${initial.exam.nama} — Ujian`);

  useEffect(() => {
    const store = useAttemptStore.getState();
    if (store.submissionId !== submission.id) {
      store.init(submission.id, initial.answers);
    }
  }, [submission.id, initial.answers]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (Object.keys(useAttemptStore.getState().pending).length > 0) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [current]);

  const leave = () => {
    clearAttemptDraft(submission.id);
    useAttemptStore.getState().clear();
  };

  const autosave = useAutosave({
    submissionId: submission.id,
    enabled: true,
    onSynced: (result) => {
      setRemaining(result.remainingSec);
      setWarnings(result.tabSwitchCount);
      setSyncError(null);
      if (result.status !== 'in_progress') {
        leave();
        navigate(`/siswa/hasil/${submission.id}`, { replace: true });
      }
    },
    onError: (error) => setSyncError(errorMessage(error)),
    onStatusChange: () => undefined,
  });

  const submitAttempt = async (auto: boolean) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const payload = pendingAnswerPayload();
      if (payload.length > 0) {
        try {
          await api.attempts.save(submission.id, payload);
        } catch (error) {
          if (!auto) {
            toastError(error, 'Jawaban terakhir belum tersimpan');
            submittingRef.current = false;
            setSubmitting(false);
            return;
          }
        }
      }
      const result = await api.attempts.submit(submission.id);
      leave();
      if (auto) {
        toast.info('Waktu habis', { description: 'Jawaban Anda otomatis dikumpulkan.' });
      }
      navigate(`/siswa/hasil/${result.submission.id}`, { replace: true });
    } catch (error) {
      submittingRef.current = false;
      setSubmitting(false);
      toastError(error, 'Gagal mengumpulkan ujian');
    }
  };

  const timer = useExamTimer(remaining, () => {
    if (submittingRef.current) return;
    void submitAttempt(true);
  });

  useAntiCheat({
    enabled: true,
    onEvent: (event) => {
      void api.attempts
        .logEvent(submission.id, event)
        .then((result) => setWarnings(result.tabSwitchCount))
        .catch(() => {
          // Anti-cheat logging is best-effort; never block answering.
        });
    },
    onWarning: (event) => {
      const message = WARNING_COPY[event];
      if (!message) return;
      setWarningBanner(true);
      toast.warning('Peringatan', { description: message });
    },
  });

  const questions = initial.questions;
  const question = questions[current];

  if (!question) {
    return <ErrorState error={new Error('Soal tidak ditemukan pada sesi ini.')} />;
  }

  const answeredCount = questions.filter((item) => hasAnswer(answers[item.id] ?? null)).length;
  const raguCount = questions.filter((item) => ragu[item.id]).length;
  const unanswered = questions.length - answeredCount;
  const timerClass = timer.isCritical
    ? 'border-destructive bg-destructive/10 text-destructive'
    : timer.isWarning
      ? 'border-warning bg-warning/10 text-warning'
      : 'border-input bg-background';

  return (
    <div className="min-h-dvh bg-muted/30 pb-24 lg:pb-0">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-3 py-2.5 sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold sm:text-base">{initial.exam.nama}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {initial.exam.mapel} • Soal {current + 1} dari {questions.length}
            </p>
          </div>

          <div
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-sm font-bold tabular-nums',
              timerClass,
            )}
            role="timer"
            aria-live={timer.isCritical ? 'assertive' : 'off'}
            aria-label={`Sisa waktu ${formatClock(timer.remaining)}`}
          >
            <Clock className="h-4 w-4" />
            {formatClock(timer.remaining)}
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => void requestFullscreen()}
            aria-label="Aktifkan layar penuh"
            className="hidden sm:inline-flex"
          >
            <Maximize />
          </Button>
          <Button onClick={() => setSubmitOpen(true)} disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : <Send />} Kumpulkan
          </Button>
        </div>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-3 pb-2 text-[11px] text-muted-foreground sm:px-5">
          <span
            className={cn(
              'inline-flex items-center gap-1',
              syncError ? 'text-destructive' : pendingCount > 0 ? 'text-warning' : 'text-success',
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {syncError
              ? 'Belum tersimpan — mencoba lagi'
              : autosave.isSaving
                ? 'Menyimpan...'
                : pendingCount > 0
                  ? 'Menunggu autosave...'
                  : lastSavedAt
                    ? 'Jawaban tersimpan'
                    : 'Autosave aktif'}
          </span>
          <span>•</span>
          <span>{answeredCount} dijawab</span>
          <span>•</span>
          <span>{unanswered} kosong</span>
          {warnings > 0 ? (
            <>
              <span>•</span>
              <span className="inline-flex items-center gap-1 text-warning">
                <ShieldAlert className="h-3 w-3" /> {warnings} peringatan fokus
              </span>
            </>
          ) : null}
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-4 px-3 py-4 sm:px-5 lg:grid-cols-[1fr_19rem]">
        <div className="min-w-0 space-y-3">
          {syncError ? (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Koneksi bermasalah</p>
                <p className="text-xs">
                  {syncError} Jawaban tetap disimpan di perangkat dan akan dikirim ulang otomatis.
                </p>
              </div>
            </div>
          ) : null}

          {warningBanner ? (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div className="flex-1">
                <p className="font-medium">Aktivitas terdeteksi</p>
                <p className="text-xs text-muted-foreground">
                  Anda terdeteksi meninggalkan tab/layar ujian. Kejadian ini tercatat untuk guru.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWarningBanner(false)}
                className="text-xs font-medium underline underline-offset-2"
              >
                Tutup
              </button>
            </div>
          ) : null}

          <QuestionCard
            question={question}
            value={answers[question.id] ?? null}
            ragu={Boolean(ragu[question.id])}
            onAnswer={(value) => useAttemptStore.getState().setAnswer(question.id, value)}
            onToggleRagu={() =>
              useAttemptStore.getState().setRagu(question.id, !ragu[question.id])
            }
            index={current}
            total={questions.length}
            shuffleSeed={submission.id}
            shuffleOptions={initial.exam.acakOpsi}
          />

          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => setCurrent((value) => Math.max(0, value - 1))}
              disabled={current === 0}
            >
              <ArrowLeft /> Sebelumnya
            </Button>
            {current < questions.length - 1 ? (
              <Button onClick={() => setCurrent((value) => Math.min(questions.length - 1, value + 1))}>
                Berikutnya <ArrowRight />
              </Button>
            ) : (
              <Button onClick={() => setSubmitOpen(true)} disabled={submitting}>
                <Send /> Kumpulkan
              </Button>
            )}
          </div>

          <div className="lg:hidden">
            <QuestionNavigator
              questions={questions}
              current={current}
              answers={answers}
              ragu={ragu}
              remaining={timer.remaining}
              onSelect={setCurrent}
            />
          </div>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-28">
            <QuestionNavigator
              questions={questions}
              current={current}
              answers={answers}
              ragu={ragu}
              remaining={timer.remaining}
              onSelect={setCurrent}
            />
            <p className="mt-3 rounded-lg bg-muted/50 p-2.5 text-[11px] leading-snug text-muted-foreground">
              Jangan menutup tab. Jawaban tersimpan otomatis ke server setiap ±5 detik dan disalin ke
              perangkat ini sebagai cadangan.
            </p>
          </div>
        </aside>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-3 py-2 backdrop-blur safe-bottom lg:hidden">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setCurrent((value) => Math.max(0, value - 1))}
            disabled={current === 0}
          >
            <ArrowLeft /> Sebelumnya
          </Button>
          <Button variant="secondary" onClick={() => setNavOpen(true)} className="gap-1.5">
            <LayoutGrid /> {current + 1}/{questions.length}
          </Button>
          {current < questions.length - 1 ? (
            <Button
              className="flex-1"
              onClick={() => setCurrent((value) => Math.min(questions.length - 1, value + 1))}
            >
              Berikutnya <ArrowRight />
            </Button>
          ) : (
            <Button className="flex-1" onClick={() => setSubmitOpen(true)} disabled={submitting}>
              <Send /> Kumpulkan
            </Button>
          )}
        </div>
      </div>

      <Dialog open={navOpen} onOpenChange={setNavOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Navigasi soal</DialogTitle>
          </DialogHeader>
          <QuestionNavigator
            questions={questions}
            current={current}
            answers={answers}
            ragu={ragu}
            remaining={timer.remaining}
            onSelect={(index) => {
              setCurrent(index);
              setNavOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        title="Kumpulkan ujian sekarang?"
        description={
          <div className="space-y-1.5">
            <p>Setelah dikumpulkan, jawaban tidak dapat diubah lagi.</p>
            <ul className="list-inside list-disc text-sm">
              <li>Dijawab: {answeredCount} soal</li>
              <li>Kosong: {unanswered} soal</li>
              <li>Ditandai ragu: {raguCount} soal</li>
            </ul>
            {unanswered > 0 ? (
              <p className="text-warning">Masih ada {unanswered} soal yang belum dijawab.</p>
            ) : null}
          </div>
        }
        confirmLabel="Kumpulkan ujian"
        cancelLabel="Periksa lagi"
        tone="primary"
        pending={submitting}
        onConfirm={() => void submitAttempt(false)}
      />
    </div>
  );
}

export function ExamTakePage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const [examToken, setExamToken] = useState('');
  const [starting, setStarting] = useState(false);
  const [attempt, setAttempt] = useState<AttemptPayload | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  useDocumentTitle('Ujian');

  const info = useQuery({
    queryKey: qk.examInfo(examId ?? ''),
    queryFn: () => api.exams.info(examId ?? ''),
    enabled: Boolean(examId) && !attempt,
    retry: false,
  });

  const begin = async () => {
    if (!examId) return;
    setStarting(true);
    setStartError(null);
    // Must be triggered by the click gesture, before any awaits.
    void requestFullscreen();
    try {
      const payload = await api.attempts.start(examId, examToken.trim() || undefined);
      setAttempt(payload);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'ALREADY_SUBMITTED') {
        const details = error.details as { submissionId?: string } | undefined;
        navigate(details?.submissionId ? `/siswa/hasil/${details.submissionId}` : '/siswa/hasil', {
          replace: true,
        });
        return;
      }
      setStartError(errorMessage(error));
      toastError(error, 'Tidak dapat memulai ujian');
    } finally {
      setStarting(false);
    }
  };

  if (attempt) return <ExamSession initial={attempt} />;

  if (!examId) {
    return <ErrorState error={new Error('Ujian tidak ditemukan pada tautan ini.')} />;
  }

  if (info.isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <PageLoader label="Menyiapkan ujian..." />
      </div>
    );
  }

  if (info.isError) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <ErrorState error={info.error} onRetry={() => void info.refetch()} />
        <div className="mt-4 text-center">
          <Button asChild variant="outline">
            <Link to="/siswa/ujian">
              <ArrowLeft /> Kembali ke daftar ujian
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const exam = info.data.exam;
  const finished = exam.attemptStatus && exam.attemptStatus !== 'in_progress';

  return (
    <div className="min-h-dvh bg-muted/30">
      <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
        <Button asChild variant="ghost" size="sm">
          <Link to="/siswa/ujian">
            <ArrowLeft /> Kembali
          </Link>
        </Button>

        {finished ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" /> Ujian sudah dikerjakan
              </CardTitle>
              <CardDescription>Anda tidak dapat mengerjakan ujian ini dua kali.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to={exam.submissionId ? `/siswa/hasil/${exam.submissionId}` : '/siswa/hasil'}>
                  Lihat hasil ujian
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{exam.mapel}</Badge>
                <Badge variant="outline">{exam.durasiMenit} menit</Badge>
                <Badge variant="outline">{exam.jumlahSoal} soal</Badge>
                {exam.requiresToken ? (
                  <Badge variant="warning" className="gap-1">
                    <LockKeyhole className="h-3 w-3" /> Butuh token
                  </Badge>
                ) : null}
              </div>
              <CardTitle className="mt-2 text-2xl">{exam.nama}</CardTitle>
              <CardDescription>
                {exam.deskripsi || 'Baca petunjuk di bawah sebelum memulai ujian.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-2 rounded-lg bg-muted/50 p-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Jadwal</dt>
                  <dd>{formatDateTime(exam.mulaiAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Berakhir</dt>
                  <dd>{formatDateTime(exam.selesaiAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Durasi pengerjaan</dt>
                  <dd>{formatDuration(exam.durasiMenit * 60)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Jumlah soal</dt>
                  <dd>{exam.jumlahSoal} soal</dd>
                </div>
              </dl>

              <div className="space-y-2 text-sm">
                <p className="font-medium">Sebelum mulai:</p>
                <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                  <li>Timer berjalan di server sejak Anda menekan tombol mulai.</li>
                  <li>Jawaban tersimpan otomatis; koneksi terputus tidak menghapus jawaban.</li>
                  <li>Jangan berpindah tab. Aktivitas tersebut dicatat sebagai peringatan.</li>
                  <li>Kunci jawaban tidak dapat diakses dari perangkat siswa.</li>
                </ul>
              </div>

              {exam.requiresToken ? (
                <div className="space-y-1.5">
                  <Label htmlFor="exam-token-input">Token ujian</Label>
                  <Input
                    id="exam-token-input"
                    value={examToken}
                    onChange={(event) => setExamToken(event.target.value.toUpperCase())}
                    placeholder="Masukkan token dari guru"
                    autoComplete="off"
                    className="font-mono uppercase"
                  />
                  <p className="text-xs text-muted-foreground">
                    Token diberikan guru/pengawas sebelum ujian dimulai.
                  </p>
                </div>
              ) : null}

              {startError ? (
                <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {startError}
                </div>
              ) : null}

              <Button
                size="lg"
                className="w-full"
                onClick={() => void begin()}
                disabled={starting || (exam.requiresToken && examToken.trim().length === 0)}
              >
                {starting ? <Loader2 className="animate-spin" /> : null}
                {starting
                  ? 'Memulai...'
                  : exam.attemptStatus === 'in_progress'
                    ? 'Lanjutkan ujian'
                    : 'Mulai ujian'}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Dengan memulai, Anda menyetujui tata tertib ujian sekolah.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
