import { create } from 'zustand';
import type { Answer, AnswerValue } from '@/types/domain';
import type { AnswerInput } from '@/types/api';
import { STORAGE_KEYS } from '@/lib/env';

export interface AttemptDraft {
  answers: Record<string, AnswerValue | null>;
  ragu: Record<string, boolean>;
  savedAt: string;
}

interface AttemptState {
  submissionId: string | null;
  answers: Record<string, AnswerValue | null>;
  ragu: Record<string, boolean>;
  /** questionId -> version that still needs syncing. */
  pending: Record<string, number>;
  versions: Record<string, number>;
  lastSavedAt: string | null;
  init: (submissionId: string, answers: Answer[]) => void;
  setAnswer: (questionId: string, value: AnswerValue | null) => void;
  setRagu: (questionId: string, ragu: boolean) => void;
  markSaved: (items: { questionId: string; version: number }[]) => void;
  markSavedAt: (iso: string) => void;
  clear: () => void;
}

function readDraft(submissionId: string): AttemptDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.attemptDraft(submissionId));
    if (!raw) return null;
    return JSON.parse(raw) as AttemptDraft;
  } catch {
    return null;
  }
}

export function persistAttemptDraft(): void {
  const state = useAttemptStore.getState();
  if (!state.submissionId) return;
  try {
    const draft: AttemptDraft = {
      answers: state.answers,
      ragu: state.ragu,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.attemptDraft(state.submissionId), JSON.stringify(draft));
  } catch {
    // Private mode may block storage; server autosave is still the source of truth.
  }
}

export function clearAttemptDraft(submissionId: string): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.attemptDraft(submissionId));
  } catch {
    // No-op.
  }
}

export function pendingAnswerPayload(): AnswerInput[] {
  const state = useAttemptStore.getState();
  return Object.keys(state.pending).map((questionId) => ({
    questionId,
    value: state.answers[questionId] ?? null,
    ragu: Boolean(state.ragu[questionId]),
  }));
}

export const useAttemptStore = create<AttemptState>((set, get) => ({
  submissionId: null,
  answers: {},
  ragu: {},
  pending: {},
  versions: {},
  lastSavedAt: null,

  init: (submissionId, answers) => {
    const serverAnswers: Record<string, AnswerValue | null> = {};
    const serverRagu: Record<string, boolean> = {};
    for (const answer of answers) {
      serverAnswers[answer.questionId] = answer.value;
      serverRagu[answer.questionId] = answer.ragu;
    }

    // Recover unsent edits written before a crash/connection loss.
    const draft = readDraft(submissionId);
    const merged = { ...serverAnswers };
    const mergedRagu = { ...serverRagu };
    const pending: Record<string, number> = {};
    const versions: Record<string, number> = {};

    if (draft) {
      for (const [questionId, value] of Object.entries(draft.answers)) {
        if (JSON.stringify(value) !== JSON.stringify(serverAnswers[questionId])) {
          merged[questionId] = value;
          mergedRagu[questionId] = Boolean(draft.ragu[questionId]);
          versions[questionId] = 1;
          pending[questionId] = 1;
        }
      }
    }

    set({
      submissionId,
      answers: merged,
      ragu: mergedRagu,
      versions,
      pending,
      lastSavedAt: null,
    });
  },

  setAnswer: (questionId, value) => {
    const version = (get().versions[questionId] ?? 0) + 1;
    set((state) => ({
      answers: { ...state.answers, [questionId]: value },
      versions: { ...state.versions, [questionId]: version },
      pending: { ...state.pending, [questionId]: version },
    }));
  },

  setRagu: (questionId, ragu) => {
    const version = (get().versions[questionId] ?? 0) + 1;
    set((state) => ({
      ragu: { ...state.ragu, [questionId]: ragu },
      versions: { ...state.versions, [questionId]: version },
      pending: { ...state.pending, [questionId]: version },
    }));
  },

  markSaved: (items) => {
    set((state) => {
      const pending = { ...state.pending };
      for (const item of items) {
        if (pending[item.questionId] === item.version) delete pending[item.questionId];
      }
      return { pending };
    });
  },

  markSavedAt: (iso) => set({ lastSavedAt: iso }),

  clear: () => {
    const current = get().submissionId;
    if (current) clearAttemptDraft(current);
    set({
      submissionId: null,
      answers: {},
      ragu: {},
      pending: {},
      versions: {},
      lastSavedAt: null,
    });
  },
}));
