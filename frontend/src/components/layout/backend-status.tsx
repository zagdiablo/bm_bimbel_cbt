import { useQuery } from '@tanstack/react-query';
import { Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { ping } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import { env } from '@/lib/env';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function useHealth() {
  return useQuery({
    queryKey: qk.health,
    queryFn: ping,
    staleTime: 60_000,
    retry: 1,
  });
}

export function HealthIndicator() {
  const health = useHealth();
  const ok = !health.isError && health.data?.ok !== false;
  const mode = env.mockEnabled ? 'Demo' : 'GAS';
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground"
      title={ok ? `Backend ${mode} terhubung` : 'Backend tidak terjangkau'}
    >
      <span
        className={cn('h-2 w-2 rounded-full', ok ? 'bg-success' : 'bg-destructive')}
        aria-hidden
      />
      <span className="hidden sm:inline">{ok ? mode : 'Offline'}</span>
      <span className="sr-only">{ok ? `Backend ${mode} terhubung` : 'Backend tidak terjangkau'}</span>
    </span>
  );
}

export function BackendBanner() {
  const health = useHealth();
  if (!health.isError) return null;
  return (
    <div role="alert" className="border-b border-destructive/30 bg-destructive/10 px-4 py-2.5">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 font-medium text-destructive">
          <WifiOff className="h-4 w-4" aria-hidden />
          Backend tidak terjangkau. Periksa koneksi atau URL Web App GAS.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void health.refetch()}
          disabled={health.isFetching}
        >
          {health.isFetching ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          Coba lagi
        </Button>
      </div>
    </div>
  );
}
