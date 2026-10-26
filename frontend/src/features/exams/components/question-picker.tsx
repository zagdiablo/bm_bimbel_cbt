import { useMemo, useState } from 'react';
import { CheckSquare, Search } from 'lucide-react';
import type { QuestionFilters } from '@/types/domain';
import { useDebounce } from '@/hooks/use-debounce';
import { useQuestions } from '@/features/questions/queries';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TableSkeleton } from '@/components/common/loading-state';
import { QuestionTypeBadge } from '@/features/questions/components/question-badges';

interface QuestionPickerProps {
  selected: string[];
  onChange: (ids: string[]) => void;
}

export function QuestionPicker({ selected, onChange }: QuestionPickerProps) {
  const [search, setSearch] = useState('');
  const query = useDebounce(search, 350);
  const filters = useMemo<QuestionFilters>(
    () => ({ q: query, page: 1, pageSize: 100 }),
    [query],
  );
  const questions = useQuestions(filters);
  const selectedSet = new Set(selected);

  const toggle = (id: string) => {
    onChange(selectedSet.has(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <CheckSquare className="h-4 w-4 text-primary" /> {selected.length} soal dipilih
        </p>
        {selected.length > 0 ? (
          <button
            type="button"
            className="text-xs text-muted-foreground underline underline-offset-2"
            onClick={() => onChange([])}
          >
            Kosongkan
          </button>
        ) : null}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari soal..."
          className="pl-9"
          aria-label="Cari soal untuk ujian"
        />
      </div>

      {questions.isPending ? (
        <TableSkeleton rows={4} columns={2} />
      ) : questions.isError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          Gagal memuat bank soal. Coba tutup dan buka kembali halaman ini.
        </p>
      ) : questions.data.items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          Tidak ada soal yang cocok. Tambahkan soal di menu Bank Soal.
        </p>
      ) : (
        <div className="max-h-80 space-y-1.5 overflow-y-auto rounded-lg border p-2 scrollbar-thin">
          {questions.data.items.map((question) => {
            const checked = selectedSet.has(question.id);
            return (
              <label
                key={question.id}
                className="flex cursor-pointer items-start gap-2 rounded-md p-2 text-sm transition-colors hover:bg-muted/60"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggle(question.id)}
                  aria-label={`Pilih soal ${question.pertanyaan.slice(0, 40)}`}
                  className="mt-0.5"
                />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2">{question.pertanyaan}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1">
                    <QuestionTypeBadge tipe={question.tipe} />
                    <Badge variant="outline" className="text-[10px]">
                      {question.kategori}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">bobot {question.bobot}</span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      )}

      {questions.data ? (
        <p className="text-xs text-muted-foreground">
          Menampilkan {questions.data.items.length} dari {questions.data.total} soal.
          {questions.data.total > 100 ? ' Persempit pencarian untuk melihat sisanya.' : ''}
        </p>
      ) : null}
    </div>
  );
}
