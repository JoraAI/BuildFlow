/** Pure text/status match helpers for inventory list filters (client-side). */

export function matchesText(
  parts: Array<string | number | null | undefined>,
  q: string,
): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return parts.some((p) => {
    if (p == null) return false;
    return String(p).toLowerCase().includes(needle);
  });
}

export function matchesStatus(actual: string | null | undefined, status: string | null | undefined): boolean {
  if (!status || status.toUpperCase() === 'ALL') return true;
  return (actual ?? '').toUpperCase() === status.toUpperCase();
}
