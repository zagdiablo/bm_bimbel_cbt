import * as React from 'react';
import { FileUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface FileDropzoneProps {
  accept: string;
  file: File | null;
  onFile: (file: File | null) => void;
  hint?: string;
  disabled?: boolean;
  id?: string;
}

export function FileDropzone({ accept, file, onFile, hint, disabled, id }: FileDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);

  const handleFiles = (files: FileList | null) => {
    const next = files?.[0];
    if (next) onFile(next);
  };

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        aria-label="Pilih atau seret file"
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && !disabled) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors',
          dragging ? 'border-primary bg-accent/60' : 'border-input bg-muted/30 hover:bg-muted/50',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <FileUp className="h-6 w-6 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">
          {file ? file.name : 'Klik atau seret file ke sini'}
        </p>
        <p className="text-xs text-muted-foreground">{hint ?? accept}</p>
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          className="sr-only"
          disabled={disabled}
          onChange={(event) => handleFiles(event.target.files)}
        />
      </div>
      {file ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => onFile(null)}
          disabled={disabled}
        >
          <X /> Hapus file
        </Button>
      ) : null}
    </div>
  );
}
