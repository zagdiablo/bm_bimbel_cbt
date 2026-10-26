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

export interface ParsedDocxQuestion extends QuestionInput {
  /** Starting line in the document, used for error messages. */
  sourceRow: number;
}

export interface DocxParseIssue {
  row: number;
  message: string;
}

export interface DocxParseResult {
  rows: ParsedDocxQuestion[];
  errors: DocxParseIssue[];
}

interface Draft {
  line: number;
  no: string;
  tipe: QuestionType | null;
  rawType: string;
  pertanyaan: string[];
  options: Map<string, string[]>;
  meta: Record<string, string[]>;
  lastField: { kind: 'pertanyaan' | 'option' | 'meta'; key?: string };
}

const QUESTION_RE = /^(\d+)[.)]\s*\[([^\]]+)]\s*(.*)$/i;
const OPTION_RE = /^([A-E])[.)]\s+(.*)$/i;
const META_RE = /^(kunci(?:\s*jawaban)?|bobot|kategori|mapel|tingkat|kesulitan|tags?|pembahasan|gambar)\s*:\s*(.*)$/i;

/**
 * Parse the canonical DOCX format documented in docs/IMPORT_FORMAT.md.
 *
 * The parser is a small state machine over mammoth's plain-text extraction:
 * a `1. [PG] ...` line opens a question, `A. ...` lines add options, and
 * `Kunci:`/`Bobot:` lines add metadata. Unrecognised lines continue the last
 * field so long questions/options can wrap across paragraphs. Any structural
 * problem is reported against the question number instead of failing silently.
 */
export async function parseQuestionDocx(file: File): Promise<DocxParseResult> {
  const mammothModule = await import('mammoth');
  const mammoth = mammothModule.default ?? mammothModule;
  const arrayBuffer = await file.arrayBuffer();
  const extracted = await mammoth.extractRawText({ arrayBuffer });
  const lines = extracted.value.split(/\r?\n/);
  const drafts: Draft[] = [];
  const preamble: string[] = [];
  let current: Draft | null = null;

  const pushLine = (draft: Draft, line: string) => {
    const target = draft.lastField;
    if (target.kind === 'option' && target.key) {
      draft.options.get(target.key)?.push(line);
      return;
    }
    if (target.kind === 'meta' && target.key) {
      draft.meta[target.key]?.push(line);
      return;
    }
    draft.pertanyaan.push(line);
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const questionMatch = QUESTION_RE.exec(line);
    if (questionMatch) {
      const [, no = '', rawType = '', firstLine = ''] = questionMatch;
      current = {
        line: drafts.length + 1,
        no,
        tipe: normalizeQuestionType(rawType),
        rawType,
        pertanyaan: firstLine ? [stripHtml(firstLine)] : [],
        options: new Map(),
        meta: {},
        lastField: { kind: 'pertanyaan' },
      };
      drafts.push(current);
      continue;
    }

    if (!current) {
      preamble.push(line);
      continue;
    }

    const optionMatch = OPTION_RE.exec(line);
    if (optionMatch) {
      const [, id = '', text = ''] = optionMatch;
      current.options.set(id.toUpperCase(), [stripHtml(text)]);
      current.lastField = { kind: 'option', key: id.toUpperCase() };
      continue;
    }

    const metaMatch = META_RE.exec(line);
    if (metaMatch) {
      const [, rawKey = '', value = ''] = metaMatch;
      const key = rawKey.toLowerCase().replace(/\s+/g, '');
      const normalizedKey =
        key === 'jawaban' || key === 'kuncijawaban'
          ? 'kunci'
          : key === 'mapel'
            ? 'kategori'
            : key === 'kesulitan'
              ? 'tingkat'
              : key === 'tag'
                ? 'tags'
                : key;
      current.meta[normalizedKey] = [value];
      current.lastField = { kind: 'meta', key: normalizedKey };
      continue;
    }

    pushLine(current, line);
  }

  const rows: ParsedDocxQuestion[] = [];
  const errors: DocxParseIssue[] = [];

  for (const draft of drafts) {
    try {
      const label = `Soal ${draft.no || draft.line}`;
      if (!draft.tipe) {
        throw new Error(`${label}: tipe "[${draft.rawType}]" tidak dikenal.`);
      }
      const pertanyaan = stripHtml(draft.pertanyaan.join('\n'));
      if (!pertanyaan) throw new Error(`${label}: pertanyaan kosong.`);

      const options: QuestionOption[] = OPTION_IDS.map((id) => ({
        id,
        teks: stripHtml((draft.options.get(id) ?? []).join(' ')),
      })).filter((option) => option.teks.length > 0);

      if ((draft.tipe === 'pg' || draft.tipe === 'pg_kompleks') && options.length < 2) {
        throw new Error(`${label}: minimal 2 opsi (A. ... dan B. ...).`);
      }
      if (draft.tipe === 'benar_salah') {
        options.splice(0, options.length, { id: 'B', teks: 'Benar' }, { id: 'S', teks: 'Salah' });
      }

      const kunciRaw = (draft.meta.kunci ?? []).join(' ').trim();
      const kunci = parseKey(draft.tipe, kunciRaw, options);
      const bobotRaw = (draft.meta.bobot ?? ['1']).join('').trim();
      const bobot = Number(bobotRaw || 1);
      if (!Number.isFinite(bobot) || bobot <= 0) throw new Error(`${label}: bobot tidak valid.`);

      const tingkatRaw = (draft.meta.tingkat ?? ['sedang']).join('').trim();
      const tingkat: Difficulty =
        normalizeDifficulty(tingkatRaw) ??
        (() => {
          throw new Error(`${label}: tingkat harus mudah/sedang/sulit.`);
        })();

      rows.push({
        sourceRow: draft.line,
        tipe: draft.tipe,
        pertanyaan,
        gambarUrl: (draft.meta.gambar ?? []).join('').trim() || undefined,
        options: draft.tipe === 'isian' || draft.tipe === 'essay' ? [] : options,
        kunci,
        pembahasan: (draft.meta.pembahasan ?? []).join('\n').trim() || undefined,
        bobot,
        tingkat,
        kategori: (draft.meta.kategori ?? ['Umum']).join('').trim() || 'Umum',
        tags: parseTags((draft.meta.tags ?? []).join(',')),
        aktif: true,
      });
    } catch (error) {
      errors.push({
        row: draft.line,
        message: error instanceof Error ? error.message : 'Blok soal tidak valid.',
      });
    }
  }

  if (drafts.length === 0) {
    errors.push({
      row: 0,
      message:
        'Tidak ada soal yang dikenali. Pastikan setiap soal diawali "1. [PG] Pertanyaan" sesuai template.',
    });
  }

  return { rows, errors };
}

export function docxPreambleWarning(preambleCount: number): string | null {
  if (preambleCount === 0) return null;
  return 'Teks sebelum soal pertama diabaikan (boleh dipakai sebagai judul dokumen).';
}
