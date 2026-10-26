import { RotateCcw } from 'lucide-react';
import type { Difficulty, QuestionFilters as Filters, QuestionType } from '@/types/domain';
import { EMPTY_QUESTION_FILTERS, DIFFICULTY_LABELS, QUESTION_TYPES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchInput } from '@/components/common/search-input';

interface QuestionFiltersProps {
  value: Filters;
  categories: string[];
  onChange: (filters: Filters) => void;
}

export function QuestionFilters({ value, categories, onChange }: QuestionFiltersProps) {
  const update = (patch: Partial<Filters>) => onChange({ ...value, ...patch, page: 1 });
  const isFiltered = Boolean(
    value.q || value.kategori || value.tipe || value.tingkat,
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
      <div className="space-y-1.5">
        <Label htmlFor="filter-q" className="text-xs text-muted-foreground">
          Cari soal
        </Label>
        <SearchInput
          id="filter-q"
          value={value.q ?? ''}
          onChange={(q) => update({ q })}
          placeholder="Cari pertanyaan atau tag..."
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Kategori</Label>
        <Select
          value={value.kategori || 'all'}
          onValueChange={(kategori) => update({ kategori: kategori === 'all' ? '' : kategori })}
        >
          <SelectTrigger aria-label="Filter kategori">
            <SelectValue placeholder="Semua kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua kategori</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Tipe</Label>
        <Select
          value={value.tipe || 'all'}
          onValueChange={(tipe) => update({ tipe: (tipe === 'all' ? '' : tipe) as QuestionType | '' })}
        >
          <SelectTrigger aria-label="Filter tipe soal">
            <SelectValue placeholder="Semua tipe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua tipe</SelectItem>
            {QUESTION_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Tingkat</Label>
        <Select
          value={value.tingkat || 'all'}
          onValueChange={(tingkat) =>
            update({ tingkat: (tingkat === 'all' ? '' : tingkat) as Difficulty | '' })
          }
        >
          <SelectTrigger aria-label="Filter tingkat kesulitan">
            <SelectValue placeholder="Semua tingkat" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua tingkat</SelectItem>
            {Object.entries(DIFFICULTY_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-end">
        <Button
          variant="ghost"
          className="w-full sm:w-auto"
          onClick={() => onChange({ ...EMPTY_QUESTION_FILTERS })}
          disabled={!isFiltered}
        >
          <RotateCcw /> Reset
        </Button>
      </div>
    </div>
  );
}
