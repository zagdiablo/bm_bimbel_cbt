import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type UserFilters } from '@/lib/api';
import type { UserInput } from '@/types/api';
import { qk } from '@/lib/query-keys';
import { toastSuccess } from '@/lib/notify';

export function useUsers(filters: UserFilters) {
  return useQuery({
    queryKey: qk.users(filters),
    queryFn: () => api.users.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UserInput) => api.users.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      toastSuccess('Pengguna ditambahkan');
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<UserInput> }) =>
      api.users.update(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      toastSuccess('Data pengguna diperbarui');
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.users.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      toastSuccess('Pengguna dihapus');
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ id, credential }: { id: string; credential: string }) =>
      api.users.resetPassword(id, credential),
    onSuccess: () => toastSuccess('Kata sandi direset', 'Sampaikan kata sandi baru kepada pengguna.'),
  });
}
