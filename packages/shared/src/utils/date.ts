/**
 * Date-only helpers (YYYY-MM-DD) for forms and scheduling.
 * Uses Asia/Kolkata for "today" to match the product locale.
 */
export const APP_TIMEZONE = 'Asia/Kolkata';

/** Current calendar date in the app timezone as YYYY-MM-DD. */
export function todayDateOnly(timeZone = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

/** Lexicographic compare for ISO date strings (-1 | 0 | 1). */
export function compareDateOnly(a: string, b: string): number {
  return a.localeCompare(b);
}

export function isDateOnOrAfter(dateOnly: string, minDateOnly: string): boolean {
  return compareDateOnly(dateOnly, minDateOnly) >= 0;
}

export function isDateAfterToday(dateOnly: string, timeZone = APP_TIMEZONE): boolean {
  return compareDateOnly(dateOnly, todayDateOnly(timeZone)) > 0;
}

/** Parse YYYY-MM-DD to UTC midnight Date (matches Prisma @db.Date storage). */
export function parseDateOnlyToDate(dateOnly: string): Date {
  const [y, m, d] = dateOnly.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

/** Format a Date (UTC date fields) as YYYY-MM-DD. */
export function dateOnlyFromDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Convert date-only to ISO datetime at UTC midnight for APIs expecting datetime. */
export function dateOnlyToIsoDateTime(dateOnly: string): string {
  return `${dateOnly}T00:00:00.000Z`;
}
