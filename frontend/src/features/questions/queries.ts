import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { QuestionFilters } from '@/types/domain';
import type { QuestionInput } from '@/types/api';
import { qk } from '@/lib/query-keys';
import { toastError, toastSuccess } from '@/lib/notify';

export function useQuestions(filters: QuestionFilters) {
  return useQuery({
    queryKey: qk.questions(filters),
    queryFn: () => api.questions.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useQuestionMeta() {
  return useQuery({
    queryKey: qk.questionMeta,
    queryFn: () => api.questions.meta(),
    staleTime: 5 * 60_000,
  });
}

function useInvalidateQuestions() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['questions'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
}

export function useCreateQuestion() {
  const invalidate = useInvalidateQuestions();
  return useMutation({
    mutationFn: (input: QuestionInput) => api.questions.create(input),
    onSuccess: () => {
      invalidate();
      toastSuccess('Soal ditambahkan');
    },
  });
}

export function useUpdateQuestion() {
  const invalidate = useInvalidateQuestions();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: QuestionInput }) =>
      api.questions.update(id, input),
    onSuccess: () => {
      invalidate();
      toastSuccess('Soal diperbarui');
    },
  });
}

export function useDeleteQuestion() {
  const invalidate = useInvalidateQuestions();
  return useMutation({
    mutationFn: (id: string) => api.questions.remove(id),
    onSuccess: () => {
      invalidate();
      toastSuccess('Soal dihapus');
    },
  });
}

export function useBulkCreateQuestions() {
  const invalidate = useInvalidateQuestions();
  return useMutation({
    mutationFn: (items: QuestionInput[]) => api.questions.bulkCreate(items),
    onSuccess: (result) => {
      invalidate();
      if (result.created > 0) {
        toastSuccess(`${result.created} soal berhasil diimpor`);
      }
      if (result.errors.length > 0) {
        toastError(
          new Error(`${result.errors.length} soal gagal disimpan: ${result.errors[0]?.message ?? ''}`),
          'Sebagian soal dilewati',
        );
      }
    },
  });
}
