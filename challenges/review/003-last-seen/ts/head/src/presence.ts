// Who's online. Times are milliseconds since 1970 (Date.now()).

export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

/** A friend counts as online if they were seen in the last two minutes. */
export function isOnline(lastSeen: number, now: number): boolean {
  return now - lastSeen < ONLINE_WINDOW_MS;
}

/**
 * "just now", "5 minutes ago", "3 hours ago", "2 days ago", or the UTC date
 * ("2026-03-14") from a week on. A time in the future counts as now.
 */
export function formatLastSeen(lastSeen: number, now: number): string {
  const elapsed = Math.max(0, now - lastSeen);
  if (elapsed < MINUTE_MS) return 'just now';
  if (elapsed < HOUR_MS) return ago(Math.floor(elapsed / MINUTE_MS), 'minute');
  if (elapsed < DAY_MS) return ago(Math.floor(elapsed / HOUR_MS), 'hour');
  if (elapsed < WEEK_MS) return ago(Math.floor(elapsed / DAY_MS), 'day');
  return new Date(lastSeen).toISOString().slice(0, 10);
}

function ago(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
}
