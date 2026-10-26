import { create } from 'zustand';
import type { User } from '@/types/domain';
import type { AuthSession } from '@/types/api';
import { STORAGE_KEYS } from '@/lib/env';

export type AuthStatus = 'booting' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: User | null;
  /** Access token lives in memory only (never persisted) to reduce XSS blast radius. */
  accessToken: string | null;
  status: AuthStatus;
  setSession: (session: AuthSession) => void;
  setAccessToken: (token: string) => void;
  setUser: (user: User) => void;
  setStatus: (status: AuthStatus) => void;
  clearSession: () => void;
}

function readRefreshToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.refreshToken);
  } catch {
    return null;
  }
}

function writeRefreshToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(STORAGE_KEYS.refreshToken, token);
    else localStorage.removeItem(STORAGE_KEYS.refreshToken);
  } catch {
    // Storage can be unavailable in private mode; sessions simply won't survive reload.
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  status: 'booting',
  setSession: (session) => {
    writeRefreshToken(session.refreshToken);
    set({ user: session.user, accessToken: session.accessToken, status: 'authenticated' });
  },
  setAccessToken: (token) => set({ accessToken: token }),
  setUser: (user) => set({ user }),
  setStatus: (status) => set({ status }),
  clearSession: () => {
    writeRefreshToken(null);
    set({ user: null, accessToken: null, status: 'unauthenticated' });
  },
}));

export function getStoredRefreshToken(): string | null {
  return readRefreshToken();
}

export function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}
