import type { QuestionInput } from '@/types/api';
import type { Difficulty, QuestionOption, QuestionType } from '@/types/domain';
import { OPTION_IDS } from './constants';
import {
  normalizeDifficulty,
  normalizeQuestionType,
  parseKey,
  parseTags,
  stripHtml,
} from './parse-common';

export interface ParsedQuestion extends QuestionInput {
  /** 1-based row in the spreadsheet, used for error messages. */
  sourceRow: number;
}

export interface ParseIssue {
  row: number;
  message: string;
}

export interface SpreadsheetParseResult {
  rows: ParsedQuestion[];
  errors: ParseIssue[];
}

const HEADER_ALIASES: Record<string, string> = {
  no: 'no',
  nomor: 'no',
  tipe: 'tipe',
  type: 'tipe',
  pertanyaan: 'pertanyaan',
  soal: 'pertanyaan',
  question: 'pertanyaan',
  opsi_a: 'opsi_a',
  opsi_b: 'opsi_b',
  opsi_c: 'opsi_c',
  opsi_d: 'opsi_d',
  opsi_e: 'opsi_e',
  kunci: 'kunci',
  jawaban: 'kunci',
  bobot: 'bobot',
  skor: 'bobot',
  kategori: 'kategori',
  mapel: 'kategori',
  tingkat: 'tingkat',
  kesulitan: 'tingkat',
  tags: 'tags',
  tag: 'tags',
  pembahasan: 'pembahasan',
  gambar: 'gambar',
  gambar_url: 'gambar',
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Parse the XLSX template. The parser is strict: rows with invalid structure are
 * reported individually instead of being silently dropped, so teachers can fix
 * the file and re-import.
 */
export async function parseQuestionWorkbook(file: File): Promise<SpreadsheetParseResult> {
  // Loaded on demand so the ~400 kB SheetJS bundle is not in the initial page.
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames.includes('Soal') ? 'Soal' : workbook.SheetNames[0];
  if (!sheetName) return { rows: [], errors: [{ row: 0, message: 'Workbook tidak memiliki sheet.' }] };
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { rows: [], errors: [{ row: 0, message: 'Sheet soal tidak ditemukan.' }] };

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const rows: ParsedQuestion[] = [];
  const errors: ParseIssue[] = [];

  rawRows.forEach((rawRow, index) => {
    const sourceRow = index + 2; // +1 header, +1 because Excel rows are 1-based
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawRow)) {
      const alias = HEADER_ALIASES[normalizeHeader(key)];
      if (alias) normalized[alias] = typeof value === 'string' ? value : String(value ?? '');
    }

    const pertanyaan = stripHtml(normalized.pertanyaan ?? '');
    if (!pertanyaan) {
      // Fully empty rows are skipped silently (teachers often leave trailing rows).
      const anyValue = Object.values(normalized).some((value) => value.trim().length > 0);
      if (anyValue) errors.push({ row: sourceRow, message: 'Kolom pertanyaan kosong.' });
      return;
    }

    try {
      const tipe = normalizeQuestionType(normalized.tipe ?? 'PG');
      if (!tipe) throw new Error('Tipe soal tidak dikenal. Gunakan PG, PG KOMPLEKS, BENAR/SALAH, ISIAN, atau ESSAY.');

      const options: QuestionOption[] = OPTION_IDS.map((id) => ({
        id,
        teks: stripHtml(normalized[`opsi_${id.toLowerCase()}`] ?? ''),
      })).filter((option) => option.teks.length > 0);

      if ((tipe === 'pg' || tipe === 'pg_kompleks') && options.length < 2) {
        throw new Error('Minimal 2 opsi jawaban (opsi_a, opsi_b, ...).');
      }

      const bobot = Number(normalized.bobot || 1);
      if (!Number.isFinite(bobot) || bobot <= 0) throw new Error('Bobot harus angka lebih dari 0.');

      const tingkatRaw = normalized.tingkat || 'sedang';
      const tingkat: Difficulty = normalizeDifficulty(tingkatRaw) ?? (() => {
        throw new Error('Tingkat harus mudah, sedang, atau sulit.');
      })();

      const kunci = parseKey(tipe, normalized.kunci ?? '', options);

      rows.push({
        sourceRow,
        tipe: tipe as QuestionType,
        pertanyaan,
        gambarUrl: normalized.gambar || undefined,
        options: tipe === 'isian' || tipe === 'essay' ? [] : options,
        kunci,
        pembahasan: normalized.pembahasan ? stripHtml(normalized.pembahasan) : undefined,
        bobot,
        tingkat,
        kategori: (normalized.kategori || 'Umum').trim(),
        tags: parseTags(normalized.tags ?? ''),
        aktif: true,
      });
    } catch (error) {
      errors.push({
        row: sourceRow,
        message: error instanceof Error ? error.message : 'Baris tidak valid.',
      });
    }
  });

  if (rows.length === 0 && errors.length === 0) {
    errors.push({ row: 0, message: 'Tidak ada baris soal yang bisa dibaca.' });
  }

  return { rows, errors };
}
