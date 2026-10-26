import { useEffect, useRef, useState } from 'react';

/**
 * Server-synced countdown.
 *
 * `remainingSec` arrives from the server on start/save/heartbeat. We only resync
 * the local deadline when the server value differs by more than 3 seconds so a
 * noisy save response cannot make the clock jump backwards or forwards.
 */
export function useExamTimer(remainingSec: number, onExpire: () => void) {
  const [remaining, setRemaining] = useState(Math.max(0, Math.floor(remainingSec)));
  const deadlineRef = useRef(Date.now() + Math.max(0, remainingSec) * 1000);
  const firedRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    const next = Date.now() + Math.max(0, remainingSec) * 1000;
    if (Math.abs(next - deadlineRef.current) > 3000) {
      deadlineRef.current = next;
    }
    if (remainingSec > 0) firedRef.current = false;
    setRemaining(Math.max(0, Math.floor((deadlineRef.current - Date.now()) / 1000)));
  }, [remainingSec]);

  useEffect(() => {
    const tick = () => {
      const seconds = Math.max(0, Math.floor((deadlineRef.current - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpireRef.current();
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return {
    remaining,
    isCritical: remaining <= 60,
    isWarning: remaining <= 300,
  };
}
