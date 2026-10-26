import type { QuestionKey, QuestionOption, QuestionType } from '@/types/domain';

/** Normalize importer aliases to the canonical question type. */
export function normalizeQuestionType(raw: string): QuestionType | null {
  const value = raw.trim().toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ');
  if (['pg', 'pilihan ganda', 'pilihan ganda tunggal', 'multiple choice'].includes(value)) return 'pg';
  if (['pg kompleks', 'pg kompleks (multi)', 'pilihan ganda kompleks', 'multiple answer'].includes(value)) {
    return 'pg_kompleks';
  }
  if (['benar salah', 'b s', 'bs', 'benar/salah', 'true false', 'true/false'].includes(value)) {
    return 'benar_salah';
  }
  if (['isian', 'isian singkat', 'short answer', 'jawaban singkat'].includes(value)) return 'isian';
  if (['essay', 'esai', 'uraian'].includes(value)) return 'essay';
  return null;
}

export function normalizeDifficulty(raw: string): 'mudah' | 'sedang' | 'sulit' | null {
  const value = raw.trim().toLowerCase();
  if (['mudah', 'easy', 'low'].includes(value)) return 'mudah';
  if (['sedang', 'medium', 'middle'].includes(value)) return 'sedang';
  if (['sulit', 'hard', 'high'].includes(value)) return 'sulit';
  return null;
}

export function parseTags(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/**
 * Parse the `kunci` cell/line into the structured key for each question type.
 * Throws a human-readable error so the import preview can show it per row.
 */
export function parseKey(
  tipe: QuestionType,
  raw: string,
  options: QuestionOption[],
): QuestionKey {
  const value = raw.trim();
  const optionIds = new Set(options.map((option) => option.id.toUpperCase()));

  if (tipe === 'pg' || tipe === 'pg_kompleks') {
    const letters = value
      .toUpperCase()
      .split(/[,;|/\s]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (letters.length === 0) throw new Error('Kunci jawaban wajib diisi (contoh: A atau A,C).');
    const invalid = letters.filter((letter) => !optionIds.has(letter));
    if (invalid.length > 0) throw new Error(`Kunci ${invalid.join(', ')} tidak ada pada opsi.`);
    const unique = Array.from(new Set(letters));
    if (tipe === 'pg' && unique.length !== 1) {
      throw new Error('Pilihan ganda hanya boleh memiliki satu kunci.');
    }
    return { selected: unique };
  }

  if (tipe === 'benar_salah') {
    const normalized = value.toLowerCase();
    if (['benar', 'b', 'true', 't', '1', 'ya'].includes(normalized)) return { value: true };
    if (['salah', 's', 'false', 'f', '0', 'tidak'].includes(normalized)) return { value: false };
    throw new Error('Kunci benar/salah harus "Benar"/"B" atau "Salah"/"S".');
  }

  if (tipe === 'isian') {
    const accepted = value
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean);
    if (accepted.length === 0) throw new Error('Isian singkat butuh jawaban diterima (pisahkan dengan |).');
    return { accepted };
  }

  return { rubrik: value || 'Nilai berdasarkan kelengkapan langkah dan jawaban akhir.' };
}

export function stripHtml(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
