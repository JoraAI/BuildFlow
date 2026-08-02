import { ApiError } from '../utils/errors';

/** Whitelist a status change; no-op when from === to. */
export function assertStatusTransition(
  from: string,
  to: string,
  allowed: Readonly<Record<string, readonly string[]>>,
  entityLabel = 'Record',
): void {
  if (from === to) return;
  const next = allowed[from];
  if (!next?.includes(to)) {
    throw ApiError.badRequest(`${entityLabel}: cannot transition from ${from} to ${to}`);
  }
}

export const RFI_STATUS_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  OPEN: ['CLOSED', 'CANCELLED'],
  ANSWERED: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
};

export const SUBMITTAL_STATUS_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: [],
  APPROVED: [],
  REJECTED: [],
  REVISE: ['SUBMITTED'],
};

export const PUNCH_STATUS_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  OPEN: ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['READY_FOR_REVIEW', 'OPEN', 'CLOSED'],
  READY_FOR_REVIEW: ['IN_PROGRESS', 'CLOSED'],
  CLOSED: [],
};

export const PETTY_CASH_STATUS_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  PENDING: ['RECONCILED', 'REJECTED'],
  RECONCILED: [],
  REJECTED: [],
};
