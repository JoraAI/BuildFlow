/**
 * Helpers to surface API / Zod validation details in the UI.
 */
import type { ApiError } from '@/lib/api-client';

export type ValidationDetail = { field?: string; message: string };

const FIELD_LABELS: Record<string, string> = {
  companyName: 'Company name',
  gstin: 'GSTIN',
  pan: 'PAN',
  address: 'Address',
  state: 'State',
  ownerName: 'Owner name',
  ownerEmail: 'Email',
  ownerPhone: 'Mobile number',
  password: 'Password',
  confirmPassword: 'Confirm password',
  email: 'Email',
  phone: 'Mobile number',
  name: 'Name',
  otp: 'OTP',
  role: 'Role',
};

export function fieldLabel(field?: string): string {
  if (!field) return 'Form';
  return FIELD_LABELS[field] ?? field;
}

export function parseValidationDetails(details?: unknown[]): ValidationDetail[] {
  if (!Array.isArray(details)) return [];
  const rows: ValidationDetail[] = [];
  for (const d of details) {
    if (!d || typeof d !== 'object') continue;
    const row = d as { field?: unknown; message?: unknown; path?: unknown };
    const field =
      typeof row.field === 'string'
        ? row.field
        : Array.isArray(row.path)
          ? row.path.filter((p) => typeof p === 'string' || typeof p === 'number').join('.')
          : undefined;
    const message = typeof row.message === 'string' ? row.message : null;
    if (!message) continue;
    rows.push({ field: field || undefined, message });
  }
  return rows;
}

/** Map of field → first error message (for Input `error` props). */
export function validationFieldErrors(details?: unknown[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of parseValidationDetails(details)) {
    const key = d.field || '_form';
    if (!out[key]) out[key] = d.message;
  }
  return out;
}

/** Human-readable multi-line / joined summary for banners. */
export function formatValidationSummary(details?: unknown[], fallback = 'Validation failed'): string {
  const rows = parseValidationDetails(details);
  if (!rows.length) return fallback;
  return rows.map((d) => `${fieldLabel(d.field)}: ${d.message}`).join('\n');
}

export function formatApiErrorMessage(err: ApiError, fallback = 'Request failed'): string {
  if (err.details?.length) {
    return formatValidationSummary(err.details, err.message || fallback);
  }
  return err.message || fallback;
}
