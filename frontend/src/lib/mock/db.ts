import type {
  Answer,
  Exam,
  ExamQuestion,
  LogEntry,
  Question,
  SchoolSettings,
  Submission,
  User,
} from '@/types/domain';
import { STORAGE_KEYS } from '@/lib/env';
import { createSeed } from './seed';

export interface MockUserRecord extends User {
  /** PBKDF2 verifier from the client (never the plain password). */
  credential: string;
  tokenVersion: number;
}

export interface MockSubmission extends Submission {
  /** Persisted question order so a resume shows the same numbering. */
  questionOrder: string[];
}

export interface MockDB {
  version: number;
  users: MockUserRecord[];
  questions: Question[];
  exams: Exam[];
  examQuestions: ExamQuestion[];
  submissions: MockSubmission[];
  answers: Answer[];
  logs: LogEntry[];
  settings: SchoolSettings;
}

const DB_VERSION = 3;

export function getDb(): MockDB {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.mockDb);
    if (raw) {
      const parsed = JSON.parse(raw) as MockDB;
      if (parsed.version === DB_VERSION) return parsed;
    }
  } catch {
    // Corrupted storage falls back to a fresh seed.
  }
  const fresh = createSeed();
  saveDb(fresh);
  return fresh;
}

export function saveDb(db: MockDB): void {
  try {
    localStorage.setItem(STORAGE_KEYS.mockDb, JSON.stringify(db));
  } catch {
    // Quota errors are non-fatal in the demo backend.
  }
}

export function resetDb(): MockDB {
  const fresh = createSeed();
  saveDb(fresh);
  return fresh;
}
