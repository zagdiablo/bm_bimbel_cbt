import { useCallback, useEffect, useRef, useState } from 'react';
import type { SaveAttemptResult, SubmissionStatus } from '@/types/domain';
import { api } from '@/lib/api';
import {
  pendingAnswerPayload,
  persistAttemptDraft,
  useAttemptStore,
} from '@/stores/attempt-store';

interface Options {
  submissionId: string | null;
  enabled: boolean;
  onSynced: (result: SaveAttemptResult) => void;
  onError: (error: unknown) => void;
  onStatusChange: (status: SubmissionStatus) => void;
}

/** Batches autosave + heartbeat into a single `attempts.save` call. */
export function useAutosave({ submissionId, enabled, onSynced, onError, onStatusChange }: Options) {
  const [isSaving, setIsSaving] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const onSyncedRef = useRef(onSynced);
  const onErrorRef = useRef(onError);
  const onStatusRef = useRef(onStatusChange);
  onSyncedRef.current = onSynced;
  onErrorRef.current = onError;
  onStatusRef.current = onStatusChange;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Debounced local draft so a tab crash still leaves recoverable answers.
  useEffect(() => {
    let handle: number | undefined;
    const unsubscribe = useAttemptStore.subscribe(() => {
      window.clearTimeout(handle);
      handle = window.setTimeout(persistAttemptDraft, 700);
    });
    return () => {
      unsubscribe();
      window.clearTimeout(handle);
    };
  }, []);

  const flush = useCallback(
    async (force = false): Promise<SaveAttemptResult | null> => {
      if (!submissionId || inFlight.current) return null;
      const snapshot = useAttemptStore.getState().pending;
      const payload = pendingAnswerPayload();
      if (payload.length === 0 && !force) return null;

      inFlight.current = true;
      if (mounted.current) setIsSaving(true);
      try {
        const result = await api.attempts.save(submissionId, payload);
        const saved = Object.entries(snapshot).map(([questionId, version]) => ({ questionId, version }));
        useAttemptStore.getState().markSaved(saved);
        useAttemptStore.getState().markSavedAt(result.serverTime);
        onSyncedRef.current(result);
        if (result.status !== 'in_progress') onStatusRef.current(result.status);
        return result;
      } catch (error) {
        onErrorRef.current(error);
        return null;
      } finally {
        inFlight.current = false;
        if (mounted.current) setIsSaving(false);
      }
    },
    [submissionId],
  );

  useEffect(() => {
    if (!enabled) return;
    let tick = 0;
    const interval = window.setInterval(() => {
      tick += 1;
      const pendingCount = Object.keys(useAttemptStore.getState().pending).length;
      if (pendingCount > 0) {
        // 5 seconds or 5 changed answers, whichever comes first.
        void flush();
      } else if (tick % 6 === 0) {
        // Merged heartbeat: same endpoint, empty answer list, ~30s interval.
        void flush(true);
      }
    }, 5000);
    return () => window.clearInterval(interval);
  }, [enabled, flush]);

  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = useAttemptStore.subscribe((state) => {
      if (Object.keys(state.pending).length >= 5) void flush();
    });
    return unsubscribe;
  }, [enabled, flush]);

  return { flush, isSaving };
}
