import { useEffect, useState, type ReactNode } from 'react';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { env } from '@/lib/env';
import { toastError } from '@/lib/notify';
import { getStoredRefreshToken, useAuthStore } from '@/stores/auth-store';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorBoundary } from './error-boundary';

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error) => toastError(error),
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiError) {
          if (
            ['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'VALIDATION', 'RESULT_HIDDEN'].includes(
              error.code,
            )
          ) {
            return false;
          }
        }
        return failureCount < 2;
      },
    },
    mutations: { retry: 0 },
  },
});

function AuthBoot({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);
  const setSession = useAuthStore((state) => state.setSession);
  const setStatus = useAuthStore((state) => state.setStatus);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) {
      setStatus('unauthenticated');
      setBootstrapped(true);
      return;
    }
    api.auth
      .refresh(refreshToken)
      .then((session) => {
        if (!cancelled) setSession(session);
      })
      .catch(() => {
        if (!cancelled) useAuthStore.getState().clearSession();
      })
      .finally(() => {
        if (!cancelled) setBootstrapped(true);
      });
    return () => {
      cancelled = true;
    };
  }, [setSession, setStatus]);

  if (!bootstrapped || status === 'booting') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <LoadingState label={`Menyiapkan ${env.appName}...`} />
      </div>
    );
  }

  return <>{children}</>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthBoot>{children}</AuthBoot>
        <Toaster richColors closeButton position="top-center" />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
