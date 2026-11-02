import { Timer, TimerOff } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { useSettings } from '../settings';
import { formatDuration, type ActiveTimer } from './timer';

const buttonClass = 'btn btn-ghost btn-sm shrink-0 font-mono tabular-nums';

/** The timer in the top bar. Hidden or shown with one click; the choice is a setting. */
export function TimerDisplay({ timer }: { timer: ActiveTimer }) {
  const { settings, update } = useSettings();
  const [failed, setFailed] = useState(false);

  const toggle = () => {
    setFailed(false);
    update({ timerEnabled: !settings.timerEnabled }).catch(() => setFailed(true));
  };
  const tone = failed ? 'text-danger' : 'text-fg';
  const failNote = failed ? " (couldn't save that change)" : '';

  if (!settings.timerEnabled) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={`Show timer${failNote}`}
        title={`Show timer${failNote}`}
        className={`${buttonClass} btn-icon ${failed ? 'text-danger' : ''}`}
      >
        <TimerOff className="i i-sm" aria-hidden="true" />
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
      className={`${buttonClass} ${tone}`}
    >
      <Timer className="i i-sm" aria-hidden="true" />
      {text}
    </button>
  );
}
