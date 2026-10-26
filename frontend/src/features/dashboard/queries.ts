import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';

export function useDashboard() {
  return useQuery({
    queryKey: qk.dashboard,
    queryFn: () => api.dashboard.stats(),
  });
}

export function useSettings() {
  return useQuery({
    queryKey: qk.settings,
    queryFn: () => api.settings.get(),
    staleTime: 5 * 60_000,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.settings.update,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.settings });
    },
  });
}
