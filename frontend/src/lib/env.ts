/** Runtime configuration. Vite injects values at build time. */

const rawMock = (import.meta.env.VITE_USE_MOCK ?? 'auto').trim().toLowerCase();
const gasApiUrl = (import.meta.env.VITE_GAS_API_URL ?? '').trim();

export const env = {
  appName: (import.meta.env.VITE_APP_NAME ?? 'CBT Sekolah').trim() || 'CBT Sekolah',
  gasApiUrl,
  googleClientId: (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim(),
  mockErrorRate: Math.min(100, Math.max(0, Number(import.meta.env.VITE_MOCK_ERROR_RATE ?? 0) || 0)),
  mockEnabled:
    rawMock === 'true' ||
    (rawMock !== 'false' && gasApiUrl.length === 0),
  isDev: import.meta.env.DEV,
} as const;

export const isMockMode = env.mockEnabled;

if (!isMockMode && !gasApiUrl) {
  // Fail loudly but do not crash the bundle: the health banner will surface this.
  console.error('[cbt] VITE_GAS_API_URL kosong sementara VITE_USE_MOCK=false.');
}

export const STORAGE_KEYS = {
  refreshToken: 'cbt.refresh-token.v1',
  attemptDraft: (submissionId: string) => `cbt.attempt-draft.${submissionId}`,
  mockDb: 'cbt.mock-db.v1',
  theme: 'cbt.theme',
} as const;
