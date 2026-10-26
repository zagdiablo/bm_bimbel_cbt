import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ExamFilters } from '@/types/domain';
import type { ExamInput } from '@/types/api';
import { qk } from '@/lib/query-keys';
import { toastSuccess } from '@/lib/notify';

export function useExams(filters: ExamFilters) {
  return useQuery({
    queryKey: qk.exams(filters),
    queryFn: () => api.exams.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useExam(id: string | undefined) {
  return useQuery({
    queryKey: qk.exam(id ?? ''),
    queryFn: () => api.exams.get(id ?? ''),
    enabled: Boolean(id),
  });
}

function useInvalidateExams() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: ['exams'] });
    void queryClient.invalidateQueries({ queryKey: ['exam'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['results'] });
    void queryClient.invalidateQueries({ queryKey: ['submissions'] });
    if (id) void queryClient.invalidateQueries({ queryKey: qk.exam(id) });
  };
}

export function useCreateExam() {
  const invalidate = useInvalidateExams();
  return useMutation({
    mutationFn: (input: ExamInput) => api.exams.create(input),
    onSuccess: (result) => {
      invalidate(result.exam.id);
      toastSuccess('Ujian dibuat', 'Langkah berikutnya: pilih soal dan terbitkan.');
    },
  });
}

export function useUpdateExam() {
  const invalidate = useInvalidateExams();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ExamInput }) => api.exams.update(id, input),
    onSuccess: (result) => {
      invalidate(result.exam.id);
      toastSuccess('Ujian diperbarui');
    },
  });
}

export function useDeleteExam() {
  const invalidate = useInvalidateExams();
  return useMutation({
    mutationFn: (id: string) => api.exams.remove(id),
    onSuccess: () => {
      invalidate();
      toastSuccess('Ujian dihapus');
    },
  });
}

export function useSetExamQuestions() {
  const invalidate = useInvalidateExams();
  return useMutation({
    mutationFn: ({ examId, questionIds }: { examId: string; questionIds: string[] }) =>
      api.exams.setQuestions(examId, questionIds),
    onSuccess: (_result, variables) => {
      invalidate(variables.examId);
      toastSuccess('Daftar soal disimpan');
    },
  });
}

export function usePublishExam() {
  const invalidate = useInvalidateExams();
  return useMutation({
    mutationFn: (id: string) => api.exams.publish(id),
    onSuccess: (result) => {
      invalidate(result.exam.id);
      toastSuccess('Ujian diterbitkan', 'Siswa pada kelas target dapat mulai mengerjakan.');
    },
  });
}

export function useCloseExam() {
  const invalidate = useInvalidateExams();
  return useMutation({
    mutationFn: (id: string) => api.exams.close(id),
    onSuccess: (result) => {
      invalidate(result.exam.id);
      toastSuccess('Ujian ditutup');
    },
  });
}

export function useAssignExam() {
  const invalidate = useInvalidateExams();
  return useMutation({
    mutationFn: ({ id, kelas }: { id: string; kelas: string[] }) => api.exams.assign(id, kelas),
    onSuccess: (result) => {
      invalidate(result.exam.id);
      toastSuccess('Kelas peserta disimpan');
    },
  });
}

export function useExamPreview(id: string | null) {
  return useQuery({
    queryKey: qk.examPreview(id ?? ''),
    queryFn: () => api.exams.preview(id ?? ''),
    enabled: Boolean(id),
  });
}
