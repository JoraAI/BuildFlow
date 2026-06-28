import { parseDateOnlyToDate } from '@buildflow/shared';

/** YYYY-MM-DD from local calendar parts (picker output). */
export function dateOnlyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Local Date at noon for picker display (avoids timezone drift). */
export function parseDateOnlyToLocalDate(dateOnly: string): Date {
  const [y, m, d] = dateOnly.split('-').map(Number);
  return new Date(y!, m! - 1, d!, 12, 0, 0, 0);
}

export function formatDateOnlyLabel(dateOnly: string): string {
  const d = parseDateOnlyToDate(dateOnly);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export { parseDateOnlyToDate, todayDateOnly, compareDateOnly, isDateAfterToday } from '@buildflow/shared';
