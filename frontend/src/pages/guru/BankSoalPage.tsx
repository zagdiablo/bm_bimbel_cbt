import { useMemo, useState } from 'react';
import { FileQuestion, Plus, Upload } from 'lucide-react';
import type { Question } from '@/types/domain';
import { EMPTY_QUESTION_FILTERS } from '@/lib/constants';
import { useDebounce } from '@/hooks/use-debounce';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useDeleteQuestion, useQuestionMeta, useQuestions } from '@/features/questions/queries';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { TableSkeleton, LoadingState } from '@/components/common/loading-state';
import { Pagination } from '@/components/common/pagination';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { QuestionFilters } from '@/features/questions/components/question-filters';
import { QuestionTable } from '@/features/questions/components/question-table';
import { QuestionFormDialog } from '@/features/questions/components/question-form-dialog';
import { QuestionPreviewDialog } from '@/features/questions/components/question-preview-dialog';
import { ImportDialog } from '@/features/questions/components/import-dialog';
import { TemplateButtons } from '@/features/questions/components/template-buttons';

export function BankSoalPage() {
  useDocumentTitle('Bank Soal');
  const [filters, setFilters] = useState({ ...EMPTY_QUESTION_FILTERS });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [preview, setPreview] = useState<Question | null>(null);
  const [deleting, setDeleting] = useState<Question | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const debouncedQuery = useDebounce(filters.q ?? '', 400);
  const queryFilters = useMemo(
    () => ({ ...filters, q: debouncedQuery, page: filters.page ?? 1, pageSize: filters.pageSize ?? 20 }),
    [filters, debouncedQuery],
  );
  const questions = useQuestions(queryFilters);
  const meta = useQuestionMeta();
  const remove = useDeleteQuestion();

  const isFiltered = Boolean(filters.q || filters.kategori || filters.tipe || filters.tingkat);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bank Soal"
        description="Kelola soal, impor massal, dan siapkan bahan ujian."
        actions={
          <>
            <TemplateButtons compact />
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload /> Import
            </Button>
            <Button onClick={openCreate}>
              <Plus /> Tambah soal
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <QuestionFilters
            value={filters}
            categories={meta.data?.kategori ?? []}
            onChange={setFilters}
          />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {questions.data ? `${questions.data.total} soal ditemukan` : 'Memuat soal...'}
            </span>
            {questions.isFetching && questions.data ? <span>Menyegarkan...</span> : null}
          </div>

          {questions.isPending ? (
            <div className="pt-2">
              <TableSkeleton rows={5} columns={4} />
            </div>
          ) : questions.isError ? (
            <ErrorState error={questions.error} onRetry={() => void questions.refetch()} />
          ) : questions.data.items.length === 0 ? (
            isFiltered ? (
              <EmptyState
                icon={FileQuestion}
                title="Tidak ada soal yang cocok"
                description="Ubah kata kunci atau reset filter untuk melihat semua soal."
                action={
                  <Button variant="outline" onClick={() => setFilters({ ...EMPTY_QUESTION_FILTERS })}>
                    Reset filter
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={FileQuestion}
                title="Bank soal masih kosong"
                description="Mulai dengan menambah soal manual atau impor dari template XLSX/DOCX."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button onClick={openCreate}>
                      <Plus /> Tambah soal
                    </Button>
                    <Button variant="outline" onClick={() => setImportOpen(true)}>
                      <Upload /> Import file
                    </Button>
                  </div>
                }
              />
            )
          ) : (
            <>
              <QuestionTable
                questions={questions.data.items}
                onEdit={(question) => {
                  setEditing(question);
                  setFormOpen(true);
                }}
                onPreview={setPreview}
                onDelete={setDeleting}
              />
              <Pagination
                page={questions.data.page}
                pageSize={questions.data.pageSize}
                total={questions.data.total}
                onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
              />
            </>
          )}
        </CardContent>
      </Card>

      {questions.isFetching && !questions.data ? <LoadingState /> : null}

      <QuestionFormDialog open={formOpen} onOpenChange={setFormOpen} question={editing} />
      <QuestionPreviewDialog
        question={preview}
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Hapus soal ini?"
        description={
          <span>
            Soal <strong>{deleting?.pertanyaan.slice(0, 80)}…</strong> akan dinonaktifkan dan tidak
            muncul lagi di bank soal. Ujian yang sudah memakai soal ini tetap aman.
          </span>
        }
        confirmLabel="Hapus soal"
        pending={remove.isPending}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </div>
  );
}
