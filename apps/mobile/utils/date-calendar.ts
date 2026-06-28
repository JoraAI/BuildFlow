import { compareDateOnly } from '@buildflow/shared';

export const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;

export function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(y!, m! - 1, d!);
  return dt.getFullYear() === y && dt.getMonth() === m! - 1 && dt.getDate() === d!;
}

export function toDateOnly(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${m}-${dd}`;
}

export function monthIndexFromDateOnly(value: string): { year: number; monthIndex: number } {
  const [y, m] = value.split('-').map(Number);
  return { year: y!, monthIndex: m! - 1 };
}

export function buildMonthGrid(year: number, monthIndex: number): (number | null)[] {
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const grid: (number | null)[] = Array.from({ length: firstDay }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) grid.push(day);
  return grid;
}

export function isDateSelectable(
  dateOnly: string,
  minimumDate?: string,
  maximumDate?: string,
): boolean {
  if (!isValidDateOnly(dateOnly)) return false;
  if (minimumDate && compareDateOnly(dateOnly, minimumDate) < 0) return false;
  if (maximumDate && compareDateOnly(dateOnly, maximumDate) > 0) return false;
  return true;
}

export function clampMonthView(
  year: number,
  monthIndex: number,
): { year: number; monthIndex: number } {
  let y = year;
  let m = monthIndex;
  while (m < 0) {
    m += 12;
    y -= 1;
  }
  while (m > 11) {
    m -= 12;
    y += 1;
  }
  return { year: y, monthIndex: m };
}
