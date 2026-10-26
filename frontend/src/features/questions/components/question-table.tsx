import { Eye, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { Question } from '@/types/domain';
import { formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DifficultyBadge, QuestionTypeBadge } from './question-badges';

interface QuestionTableProps {
  questions: Question[];
  onEdit: (question: Question) => void;
  onPreview: (question: Question) => void;
  onDelete: (question: Question) => void;
}

function Actions({
  question,
  onEdit,
  onPreview,
  onDelete,
}: {
  question: Question;
  onEdit: (question: Question) => void;
  onPreview: (question: Question) => void;
  onDelete: (question: Question) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Aksi untuk soal ${question.pertanyaan.slice(0, 30)}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onPreview(question)}>
          <Eye /> Pratinjau
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onEdit(question)}>
          <Pencil /> Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={() => onDelete(question)}>
          <Trash2 /> Hapus
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function QuestionTable({ questions, onEdit, onPreview, onDelete }: QuestionTableProps) {
  return (
    <>
      {/* Mobile cards: the bank is often browsed from a phone between classes. */}
      <div className="space-y-3 md:hidden">
        {questions.map((question) => (
          <div key={question.id} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <QuestionTypeBadge tipe={question.tipe} />
                <DifficultyBadge tingkat={question.tingkat} />
              </div>
              <Actions question={question} onEdit={onEdit} onPreview={onPreview} onDelete={onDelete} />
            </div>
            <p className="mt-2 line-clamp-3 text-sm">{question.pertanyaan}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{question.kategori}</Badge>
              <span>Bobot {question.bobot}</span>
              <span>•</span>
              <span>{formatDateTime(question.updatedAt)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[46%]">Soal</TableHead>
              <TableHead>Klasifikasi</TableHead>
              <TableHead className="text-center">Bobot</TableHead>
              <TableHead>Diperbarui</TableHead>
              <TableHead className="w-12 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {questions.map((question) => (
              <TableRow key={question.id}>
                <TableCell>
                  <p className="line-clamp-2 text-sm font-medium">{question.pertanyaan}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {question.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[11px] text-muted-foreground">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <QuestionTypeBadge tipe={question.tipe} />
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span>{question.kategori}</span>
                      <span>•</span>
                      <span>{question.tingkat}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center tabular-nums">{question.bobot}</TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatDateTime(question.updatedAt)}
                </TableCell>
                <TableCell className="text-right">
                  <Actions question={question} onEdit={onEdit} onPreview={onPreview} onDelete={onDelete} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
