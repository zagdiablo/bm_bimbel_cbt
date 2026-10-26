import type { AnswerValue, Question } from '@/types/domain';
import { hasAnswer } from './constants';
import { normalizeText } from './utils';

/**
 * Client-side grading preview. The server always re-grades on submit; this is
 * only used for instant feedback in review screens and unit-style checks.
 */
export function gradeValue(question: Question, value: AnswerValue | null): boolean {
  if (!hasAnswer(value) || !value) return false;
  const key = question.kunci;
  if (!key) return false;

  switch (question.tipe) {
    case 'pg':
      return (
        value.selected?.length === 1 &&
        key.selected?.length === 1 &&
        value.selected[0] === key.selected[0]
      );
    case 'pg_kompleks': {
      const answer = [...(value.selected ?? [])].sort().join('|');
      const expected = [...(key.selected ?? [])].sort().join('|');
      return answer.length > 0 && answer === expected;
    }
    case 'benar_salah':
      return typeof value.value === 'boolean' && value.value === key.value;
    case 'isian': {
      const answer = normalizeText(value.text ?? '');
      if (!answer) return false;
      return (key.accepted ?? []).some((item) => normalizeText(item) === answer);
    }
    default:
      return false;
  }
}
