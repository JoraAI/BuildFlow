/** Format a number as Indian Rupees with the ₹ symbol and Indian comma grouping. */
export function formatINR(amount: number | string | undefined | null): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount ?? 0;
  if (isNaN(n)) return '₹0';
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

/** Compact format: ₹1.2Cr, ₹45L, ₹12K - useful for dashboards. */
export function formatINRCompact(amount: number | string | undefined | null): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount ?? 0;
  if (isNaN(n)) return '₹0';
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)}Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

export function formatDate(date: string | Date | undefined | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Format an ISO date/time as HH:MM AM/PM (e.g. "09:30 AM"). */
export function formatTime(date: string | Date | undefined | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function daysBetween(start: string | Date, end: string | Date): number {
  const s = typeof start === 'string' ? new Date(start) : new Date(start);
  const e = typeof end === 'string' ? new Date(end) : new Date(end);
  // FIX (MOB-L14): Normalize to date-only (midnight UTC) before diffing so
  // time components don't cause off-by-one errors with Math.ceil.
  s.setUTCHours(0, 0, 0, 0);
  e.setUTCHours(0, 0, 0, 0);
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
