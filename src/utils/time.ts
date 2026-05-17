/** Relative time for display (e.g. "23s ago"). */
export function formatRelativeTimeAgo(from: Date, now = Date.now()): string {
  const secs = Math.max(0, Math.floor((now - from.getTime()) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}
