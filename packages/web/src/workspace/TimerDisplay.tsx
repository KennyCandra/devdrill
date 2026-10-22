import { Timer, TimerOff } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { useSettings } from '../settings';
import { formatDuration, type ActiveTimer } from './timer';

const buttonClass =
  'flex shrink-0 items-center rounded hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-accent';

/** The timer in the top bar. Hidden or shown with one click; the choice is a setting. */
export function TimerDisplay({ timer }: { timer: ActiveTimer }) {
  const { settings, update } = useSettings();
  const [failed, setFailed] = useState(false);

  const toggle = () => {
    setFailed(false);
    update({ timerEnabled: !settings.timerEnabled }).catch(() => setFailed(true));
  };
  const tone = failed ? 'text-danger' : 'text-muted';
  const failNote = failed ? " (couldn't save that change)" : '';

  if (!settings.timerEnabled) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={`Show timer${failNote}`}
        title={`Show timer${failNote}`}
        className={`${buttonClass} size-7 justify-center ${tone}`}
      >
        <TimerOff size={15} aria-hidden="true" />
      </button>
    );
  }
  return <ShownTimer timer={timer} onHide={toggle} tone={tone} failNote={failNote} />;
}

/** Only this part re-renders every second, and only while the timer is shown. */
function ShownTimer({
  timer,
  onHide,
  tone,
  failNote,
}: {
  timer: ActiveTimer;
  onHide: () => void;
  tone: string;
  failNote: string;
}) {
  const elapsed = useSyncExternalStore(timer.subscribe, timer.getSnapshot);
  const text = formatDuration(elapsed);
  return (
    <button
      type="button"
      onClick={onHide}
      aria-label={`Time on this attempt ${text}. Hide timer${failNote}`}
      title={`Hide timer${failNote}`}
      className={`${buttonClass} gap-1.5 px-1.5 font-mono text-[12px] tabular-nums ${tone}`}
    >
      <Timer size={14} aria-hidden="true" />
      {text}
    </button>
  );
}
