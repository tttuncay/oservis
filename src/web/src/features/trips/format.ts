/**
 * Formatting for the trip screens.
 *
 * Shared rather than repeated, because the same distance appears on the list, the detail
 * header and the route sheet preview, and three roundings that disagree read as three
 * different numbers.
 *
 * Nothing here computes: every value arrives already decided by the server (SDD §1.2 P2).
 */

/**
 * An ISO instant as `HH:MM`.
 *
 * The browser's own timezone, which for a Turkish operator is the tenant's. Deliberately
 * not `toLocaleTimeString` with defaults: several locales append seconds, and a stop list
 * of `07:14:00` is harder to scan than one of `07:14`.
 */
export function formatClock(value: string | null): string {
  if (!value) return '—';

  return new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
}

/** Metres as kilometres, one decimal. Under a kilometre stays in metres. */
export function formatDistance(metres: number | null): string {
  if (metres === null) return '—';
  return metres < 1_000 ? `${metres} m` : `${(metres / 1_000).toFixed(1)} km`;
}

/** Seconds as hours and minutes. A route is measured in minutes, never in seconds. */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';

  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);

  return hours > 0 ? `${hours} sa ${minutes % 60} dk` : `${minutes} dk`;
}
