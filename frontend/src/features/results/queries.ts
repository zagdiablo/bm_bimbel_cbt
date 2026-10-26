import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type SubmissionFilters } from '@/lib/api';
import type { SubmissionStatus } from '@/types/domain';
import type { GradeItem } from '@/types/api';
import { qk } from '@/lib/query-keys';
import { toastSuccess } from '@/lib/notify';

export function useMyResults() {
  return useQuery({
    queryKey: qk.resultsMine,
    queryFn: () => api.results.mine(),
  });
}

export function useResultDetail(submissionId: string | undefined) {
  return useQuery({
    queryKey: qk.resultDetail(submissionId ?? ''),
    queryFn: () => api.results.detail(submissionId ?? ''),
    enabled: Boolean(submissionId),
  });
}

export function useSubmissions(filters: SubmissionFilters & { status?: SubmissionStatus | '' }) {
  return useQuery({
    queryKey: qk.submissions(filters),
    queryFn: () => api.submissions.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useSubmissionDetail(submissionId: string | null) {
  return useQuery({
    queryKey: qk.submission(submissionId ?? ''),
    queryFn: () => api.submissions.get(submissionId ?? ''),
    enabled: Boolean(submissionId),
  });
}

export function useExamResults(examId: string | null) {
  return useQuery({
    queryKey: qk.examResults(examId ?? ''),
    queryFn: () => api.results.list(examId ?? ''),
    enabled: Boolean(examId),
  });
}

export function useExamStats(examId: string | null) {
  return useQuery({
    queryKey: qk.stats(examId ?? ''),
    queryFn: () => api.results.stats(examId ?? ''),
    enabled: Boolean(examId),
  });
}

export function useGradeEssay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ submissionId, items }: { submissionId: string; items: GradeItem[] }) =>
      api.submissions.gradeEssay(submissionId, items),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['submissions'] });
      void queryClient.invalidateQueries({ queryKey: ['results'] });
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
      void queryClient.invalidateQueries({ queryKey: qk.submission(variables.submissionId) });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toastSuccess('Nilai essay disimpan');
    },
  });
}

export function useForceSubmit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (submissionId: string) => api.submissions.forceSubmit(submissionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['submissions'] });
      void queryClient.invalidateQueries({ queryKey: ['results'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toastSuccess('Pengerjaan dikumpulkan paksa');
    },
  });
}
