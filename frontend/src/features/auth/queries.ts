import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import type { LoginInput } from '@/types/api';
import { homeForRole } from '@/lib/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { toastSuccess } from '@/lib/notify';

export function useLogin() {
  const setSession = useAuthStore((state) => state.setSession);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (input: LoginInput) => api.auth.login(input),
    onSuccess: (session) => {
      setSession(session);
      toastSuccess(`Selamat datang, ${session.user.name.split(' ')[0]}`);
      navigate(homeForRole(session.user.role), { replace: true });
    },
  });
}

export function useGoogleLogin() {
  const setSession = useAuthStore((state) => state.setSession);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (idToken: string) => api.auth.google(idToken),
    onSuccess: (session) => {
      setSession(session);
      toastSuccess(`Selamat datang, ${session.user.name.split(' ')[0]}`);
      navigate(homeForRole(session.user.role), { replace: true });
    },
  });
}

export function useLogoutMutation() {
  const clearSession = useAuthStore((state) => state.clearSession);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => api.auth.logout(),
    onSettled: () => {
      clearSession();
      queryClient.clear();
      navigate('/login', { replace: true });
    },
  });
}
