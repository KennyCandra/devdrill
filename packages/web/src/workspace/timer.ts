const TICK_MS = 1000;
/** A longer gap means the computer slept or the tab was frozen; don't count it. */
const MAX_TICK_GAP_MS = 5000;

const timeKey = (id: string) => `devdrill-time-${id}`;

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

/**
 * Active time on the current attempt at a challenge: it only counts while the page is
 * visible, and starts over after a solve or a file reset. Kept per browser so it
 * survives reloads. A tiny store, so only the timer display re-renders every second.
 */
export class ActiveTimer {
  private elapsed: number;
  private lastTick = Date.now();
  private interval: ReturnType<typeof setInterval> | undefined;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly id: string) {
    this.elapsed = this.read();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Whole seconds, so subscribers re-render at most once a second. */
  getSnapshot = (): number => Math.floor(this.elapsed / 1000) * 1000;

  get(): number {
    return this.elapsed;
  }

  start(): void {
    if (this.interval) return;
    this.lastTick = Date.now();
    this.interval = setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    clearInterval(this.interval);
    this.interval = undefined;
  }

  /** Starts a new attempt. */
  reset(): void {
    this.elapsed = 0;
    this.lastTick = Date.now();
    this.save();
    this.emit();
  }

  private tick(): void {
    const now = Date.now();
    if (document.visibilityState === 'visible') {
      this.elapsed = addTick(this.elapsed, this.lastTick, now);
      this.save();
      this.emit();
    }
    this.lastTick = now;
  }

  private read(): number {
    try {
      return Number(localStorage.getItem(timeKey(this.id))) || 0;
    } catch {
      return 0;
    }
  }

  private save(): void {
    try {
      localStorage.setItem(timeKey(this.id), String(Math.round(this.elapsed)));
    } catch {
      // Not persisted; the timer still runs for this visit.
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
