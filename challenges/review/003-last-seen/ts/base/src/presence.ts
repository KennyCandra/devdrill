// Who's online. Times are milliseconds since 1970 (Date.now()).

export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

/** A friend counts as online if they were seen in the last two minutes. */
export function isOnline(lastSeen: number, now: number): boolean {
  return now - lastSeen < ONLINE_WINDOW_MS;
}
