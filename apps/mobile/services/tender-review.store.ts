/**
 * Pending tender extraction awaiting user confirm before estimate create.
 * Survives navigate from Proposals hub → proposal detail.
 */
import type { TenderExtractedItem } from '@/services/proposal.queries';

export interface PendingTenderReview {
  proposalId: string;
  items: TenderExtractedItem[];
  notes?: string;
  sourceTextLength: number;
  fileUrl?: string;
  filename?: string;
}

let pending: PendingTenderReview | null = null;

export function setPendingTenderReview(next: PendingTenderReview | null) {
  pending = next;
}

export function getPendingTenderReview(proposalId?: string): PendingTenderReview | null {
  if (!pending) return null;
  if (proposalId && pending.proposalId !== proposalId) return null;
  return pending;
}

export function clearPendingTenderReview(proposalId?: string) {
  if (!pending) return;
  if (proposalId && pending.proposalId !== proposalId) return;
  pending = null;
}
