/**
 * Parse sidebar `lastSeen` tokens (e.g. "2m", "1.2h", "now") to elapsed minutes.
 * Returns null when the value cannot be parsed.
 */
export function parseLastSeenMinutes(lastSeen?: string): number | null {
  if (!lastSeen || lastSeen === '—') return null;
  if (lastSeen === 'now') return 0;

  const match = lastSeen.trim().match(/^(\d+(?:\.\d+)?)\s*(m|h)$/i);
  if (!match) return null;

  const value = parseFloat(match[1]);
  return match[2].toLowerCase() === 'h' ? value * 60 : value;
}

/** True when last-seen label represents more than `minutes` ago. */
export function isLastSeenOlderThan(lastSeen: string | undefined, minutes: number): boolean {
  const elapsed = parseLastSeenMinutes(lastSeen);
  if (elapsed === null) return false;
  return elapsed > minutes;
}

/** Relative time for display (e.g. "23s ago"). */
export function formatRelativeTimeAgo(from: Date, now = Date.now()): string {
  const secs = Math.max(0, Math.floor((now - from.getTime()) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}
