import { Timer, TimerOff } from 'lucide-react';
import { useSettings } from '../settings';
import { formatDuration } from './timer';

/** The timer in the top bar. Hidden or shown with one click; the choice is a setting. */
export function TimerDisplay({ elapsedMs }: { elapsedMs: number }) {
  const { settings, update } = useSettings();
  const toggle = () => void update({ timerEnabled: !settings.timerEnabled }).catch(() => undefined);

  if (!settings.timerEnabled) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label="Show timer"
        title="Show timer"
        className="flex size-7 shrink-0 items-center justify-center rounded text-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
      >
        <TimerOff size={15} aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title="Hide timer"
      className="flex shrink-0 items-center gap-1.5 rounded px-1.5 font-mono text-[12px] text-muted tabular-nums hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
    >
      <Timer size={14} aria-hidden="true" />
      <span aria-label={`Time spent ${formatDuration(elapsedMs)}`}>
        {formatDuration(elapsedMs)}
      </span>
    </button>
  );
}
