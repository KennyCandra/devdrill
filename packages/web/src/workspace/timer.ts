import { useEffect, useRef, useState } from 'react';

const TICK_MS = 1000;
/** A longer gap means the computer slept or the tab was frozen; don't count it. */
const MAX_TICK_GAP_MS = 5000;

const timeKey = (id: string) => `bughunt-time-${id}`;

/** "4:05", "12:30", "1:02:03". */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Adds the time since the last tick, ignoring gaps from sleep or a frozen tab. */
export function addTick(elapsedMs: number, lastTick: number, now: number): number {
  const gap = now - lastTick;
  return gap > 0 && gap <= MAX_TICK_GAP_MS ? elapsedMs + gap : elapsedMs;
}

function readElapsed(id: string): number {
  try {
    return Number(localStorage.getItem(timeKey(id))) || 0;
  } catch {
    return 0;
  }
}

/**
 * Time actively spent on a challenge: only while this page is open and visible.
 * Kept per browser, so it survives reloads. Returns the elapsed ms and a getter
 * for event handlers (Submit) that need the latest value.
 */
export function useActiveTime(id: string): [number, () => number] {
  const [elapsed, setElapsed] = useState(() => readElapsed(id));
  const elapsedRef = useRef(elapsed);

  useEffect(() => {
    let lastTick = Date.now();
    const tick = () => {
      const now = Date.now();
      if (document.visibilityState === 'visible') {
        elapsedRef.current = addTick(elapsedRef.current, lastTick, now);
        setElapsed(elapsedRef.current);
        try {
          localStorage.setItem(timeKey(id), String(Math.round(elapsedRef.current)));
        } catch {
          // Not persisted; the timer still runs for this visit.
        }
      }
      lastTick = now;
    };
    const interval = setInterval(tick, TICK_MS);
    return () => clearInterval(interval);
  }, [id]);

  return [elapsed, () => elapsedRef.current];
}
