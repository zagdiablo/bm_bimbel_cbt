import { env } from './env';
import { mockRequest } from './mock/handler';
import {
  getStoredRefreshToken,
  useAuthStore,
} from '@/stores/auth-store';
import type { AuthSession, Envelope } from '@/types/api';

export class ApiError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

interface TransportResult<T> {
  envelope: Envelope<T>;
  network: boolean;
}

const RETRYABLE_CODES = new Set(['LOCK_TIMEOUT', 'INTERNAL', 'NETWORK', 'TIMEOUT']);
const MAX_RETRIES = 3;
const MOCK_LATENCY: [number, number] = [300, 800];

function normalizeEnvelope<T>(raw: unknown): Envelope<T> {
  if (raw && typeof raw === 'object' && 'ok' in raw) {
    return raw as Envelope<T>;
  }
  return {
    ok: false,
    error: { code: 'BAD_RESPONSE', message: 'Respons backend tidak dikenali.' },
  };
}

async function transport<T>(action: string, payload: Record<string, unknown>): Promise<TransportResult<T>> {
  if (env.mockEnabled) {
    // Mock mirrors realistic latency so loading/skeleton states are exercised.
    const delay = MOCK_LATENCY[0] + Math.random() * (MOCK_LATENCY[1] - MOCK_LATENCY[0]);
    await new Promise((resolve) => setTimeout(resolve, delay));
    const envelope = await mockRequest<T>(action, payload);
    return { envelope: normalizeEnvelope<T>(envelope), network: false };
  }

  if (!env.gasApiUrl) {
    return {
      envelope: {
        ok: false,
        error: {
          code: 'NO_BACKEND',
          message: 'VITE_GAS_API_URL belum diisi. Salin URL Web App GAS ke file .env.',
        },
      },
      network: false,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${env.gasApiUrl}?action=${encodeURIComponent(action)}`, {
      method: 'POST',
      // text/plain avoids a CORS preflight, which Apps Script cannot answer.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: controller.signal,
    });
    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        envelope: {
          ok: false,
          error: {
            code: 'BACKEND_HTML',
            message:
              'Backend mengembalikan halaman non-JSON. Pastikan deployment Web App = "Anyone" dan URL berakhiran /exec.',
            details: text.slice(0, 200),
          },
        },
        network: false,
      };
    }
    const envelope = normalizeEnvelope<T>(parsed);
    if (!envelope.ok && !envelope.error) {
      envelope.error = { code: 'UNKNOWN', message: 'Terjadi kesalahan pada backend.' };
    }
    return { envelope, network: false };
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError';
    return {
      envelope: {
        ok: false,
        error: {
          code: aborted ? 'TIMEOUT' : 'NETWORK',
          message: aborted
            ? 'Permintaan melebihi 30 detik. Periksa koneksi lalu coba lagi.'
            : 'Tidak dapat menghubungi backend. Periksa koneksi internet Anda.',
        },
      },
      network: true,
    };
  } finally {
    clearTimeout(timeout);
  }
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return false;
  refreshInFlight ??= (async () => {
    const result = await transport<AuthSession>('auth.refresh', { refreshToken });
    if (result.envelope.ok && result.envelope.data) {
      useAuthStore.getState().setSession(result.envelope.data);
      return true;
    }
    useAuthStore.getState().clearSession();
    return false;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

function backoffDelay(attempt: number): number {
  // 500ms, 1s, 2s — capped so the UI stays responsive.
  return Math.min(4000, 500 * 2 ** attempt);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface RequestOptions {
  /** Skip attaching the access token (login/refresh/health). */
  publicAction?: boolean;
  /** Disable retries for actions where duplicates are undesirable (e.g. start attempt). */
  noRetry?: boolean;
}

export async function request<T>(
  action: string,
  payload: Record<string, unknown> = {},
  options: RequestOptions = {},
): Promise<T> {
  let refreshed = false;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const token = options.publicAction ? null : useAuthStore.getState().accessToken;
    const body: Record<string, unknown> = { ...payload };
    if (token) body.token = token;

    const { envelope } = await transport<T>(action, body);

    if (envelope.ok) return (envelope.data ?? ({} as T)) as T;

    const code = envelope.error?.code ?? 'UNKNOWN';

    if (code === 'TOKEN_EXPIRED' && !options.publicAction && !refreshed) {
      refreshed = true;
      const ok = await refreshSession();
      if (ok) continue;
      throw new ApiError('SESSION_EXPIRED', 'Sesi berakhir. Silakan masuk kembali.');
    }

    if (options.noRetry || !RETRYABLE_CODES.has(code)) {
      throw new ApiError(code, envelope.error?.message ?? 'Terjadi kesalahan.', envelope.error?.details);
    }

    if (attempt < MAX_RETRIES) {
      await wait(backoffDelay(attempt));
      continue;
    }

    throw new ApiError(
      code,
      envelope.error?.message ??
        'Server sedang sibuk. Jawaban Anda tersimpan di perangkat dan akan dicoba lagi.',
      envelope.error?.details,
    );
  }

  throw new ApiError('UNKNOWN', 'Permintaan gagal setelah beberapa percobaan.');
}

/** Health check used by the connectivity banner on boot. */
export async function ping(): Promise<{ ok: boolean; mode: 'mock' | 'gas'; message?: string }> {
  if (env.mockEnabled) return { ok: true, mode: 'mock' };
  const result = await transport<{ version: string }>('health', {});
  return result.envelope.ok
    ? { ok: true, mode: 'gas' }
    : { ok: false, mode: 'gas', message: result.envelope.error?.message ?? 'Backend tidak terjangkau.' };
}
