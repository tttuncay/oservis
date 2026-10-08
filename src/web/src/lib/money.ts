import { API_BASE_PATH } from '@servisapp/contracts';
import { formatMoney as format } from '@servisapp/shared';
import { currentAccessToken } from '@/auth/session-store';
import { t } from '@/i18n';

/**
 * Money on screen — FR-FIN-290, SDD §1.2 P2.
 *
 * ## Formatting only, never arithmetic
 *
 * *"Clients render and queue. They never decide permissions and never compute money."*
 * Every function here takes a decimal string the server produced and returns a string to
 * display. Nothing sums, nothing subtracts, nothing multiplies — a balance, a total and a
 * profit all arrive already computed, because a figure computed twice is a figure that
 * can disagree with itself.
 *
 * If a screen needs a number the server does not send, the fix is a field on the DTO.
 */

const TURKISH = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * `'1234.56'` → `'1.234,56 ₺'`.
 *
 * Delegates to `packages/shared`, which is where the one implementation now lives and
 * where the string-splitting argument is written out. Kept as a name because ~forty call
 * sites in this application read it, and because the console's other formatters are here.
 */
export function formatMoney(amount: string, currency = 'TRY'): string {
  return format(amount, currency);
}

/** A percentage as the server sends it — `'12.50'` → `'%12,50'`. */
export function formatPercent(value: string): string {
  return `%${TURKISH.format(Number(value))}`;
}

/** `'2026-09-15'` → `'15.09.2026'`, the Turkish civil-date convention. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';

  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}.${month}.${year}`;
}

/**
 * `'2026-09-01'` → `'Eylül 2026'`.
 *
 * Month names come from `packages/i18n` rather than a list here — they are user-facing
 * text like any other, and NFR-USA-050 admits no exception for words that happen to be
 * data. The `no-literal-turkish` ESLint rule enforces it.
 */
export function formatMonth(value: string): string {
  const [year, month = '01'] = value.slice(0, 7).split('-');

  return `${t(`month.${month}` as Parameters<typeof t>[0])} ${year}`;
}

/** Whether a decimal string is negative, for styling a figure without parsing it. */
export function isNegative(amount: string): boolean {
  return amount.startsWith('-');
}

/**
 * Opens a report export in a new tab — FR-FIN-280.
 *
 * The file is fetched rather than linked, because the API is token-authenticated and a
 * bare `<a href>` carries no `Authorization` header. Putting the token in the query
 * string instead would write it into the browser's history and into every proxy log
 * between here and the server, which NFR-SEC-070 exists to prevent.
 *
 * So the blob is fetched with the header, handed to the browser as an object URL, and
 * the URL is revoked once the download has started — it never becomes a shareable link.
 */
export async function downloadReport(
  path: string,
  query: Record<string, string | number | boolean | undefined>,
  filename: string,
): Promise<void> {
  const baseUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? API_BASE_PATH;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) search.set(key, String(value));
  }

  const response = await fetch(`${baseUrl}${path}?${search.toString()}`, {
    headers: { Authorization: `Bearer ${currentAccessToken() ?? ''}` },
  });

  if (!response.ok) {
    throw new Error(`export failed with status ${response.status}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  // Revoked on the next tick rather than immediately: Safari cancels an in-flight
  // download when the object URL is released synchronously after the click.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
}
