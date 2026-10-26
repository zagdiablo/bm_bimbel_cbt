import { useEffect, useRef } from 'react';

export type CheatEvent =
  | 'tab_switch'
  | 'blur'
  | 'copy'
  | 'paste'
  | 'contextmenu'
  | 'fullscreen_exit';

interface Options {
  enabled: boolean;
  onEvent: (event: CheatEvent) => void;
  /** Called only for events the student should be warned about (not every blur). */
  onWarning: (event: CheatEvent) => void;
}

const THROTTLE_MS: Record<CheatEvent, number> = {
  tab_switch: 1000,
  blur: 3000,
  copy: 4000,
  paste: 4000,
  contextmenu: 4000,
  fullscreen_exit: 3000,
};

/**
 * Basic anti-cheat signals. The server only *records* these events and the UI
 * shows a counter — we intentionally never auto-submit (AUTO_SUBMIT_ON_CHEAT is
 * false) because switching tabs can happen for legitimate reasons such as an
 * incoming call or notification.
 */
export function useAntiCheat({ enabled, onEvent, onWarning }: Options) {
  const lastSent = useRef<Partial<Record<CheatEvent, number>>>({});
  const onEventRef = useRef(onEvent);
  const onWarningRef = useRef(onWarning);
  onEventRef.current = onEvent;
  onWarningRef.current = onWarning;

  useEffect(() => {
    if (!enabled) return;

    const emit = (event: CheatEvent, warn: boolean) => {
      const now = Date.now();
      const last = lastSent.current[event] ?? 0;
      if (now - last < THROTTLE_MS[event]) return;
      lastSent.current[event] = now;
      onEventRef.current(event);
      if (warn) onWarningRef.current(event);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') emit('tab_switch', true);
    };
    const onBlur = () => emit('blur', false);
    const onCopy = (event: Event) => {
      event.preventDefault();
      emit('copy', true);
    };
    const onPaste = (event: Event) => {
      event.preventDefault();
      emit('paste', true);
    };
    const onContextMenu = (event: Event) => {
      event.preventDefault();
      emit('contextmenu', false);
    };
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) emit('fullscreen_exit', true);
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('fullscreenchange', onFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [enabled]);
}

export async function requestFullscreen(): Promise<boolean> {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }
    return true;
  } catch {
    // iOS Safari does not support fullscreen on arbitrary elements.
    return false;
  }
}
