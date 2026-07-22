/**
 * BuildFlow - E-signature service for POs and Indents (requisitions).
 *
 * Captures an authenticated user's signature on a procurement document:
 *   - Records who signed (signedBy), when (signedAt), their display name
 *     (signedByName), and a tamper-evident hash (signatureHash) of the
 *     document's key fields at signing time.
 *
 * The signature hash lets a reviewer verify later that the document hasn't
 * changed since it was signed (re-hash + compare). The hash covers:
 *   documentNumber, total amount, vendorName, line items (id+qty+rate).
 *
 * Signing is idempotent for a given document: signing again replaces the
 * previous signature (and is audit-logged).
 */
import { createHash } from 'crypto';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { assertProjectAccess } from '../middleware/project-access.middleware';
import { recordAudit } from '../utils/audit';

type Signable =
  | { kind: 'PO'; record: { id: string; poNumber: string; vendorName: string; totalAmount: unknown; projectId: string; companyId: string; lines: Array<{ resourceId: string; quantity: unknown; rate: unknown }> } }
  | { kind: 'REQUISITION'; record: { id: string; reqNumber: string; vendorName?: string; projectId: string; companyId: string; lines: Array<{ resourceId: string; quantity: unknown; expectedRate?: unknown }> } };

function hashDocument(s: Signable): string {
  const h = createHash('sha256');
  if (s.kind === 'PO') {
    h.update(`PO|${s.record.poNumber}|${s.record.vendorName}|${s.record.totalAmount}`);
    for (const l of s.record.lines) {
      h.update(`|${l.resourceId}:${l.quantity}:${l.rate}`);
    }
  } else {
    h.update(`REQ|${s.record.reqNumber}`);
    for (const l of s.record.lines) {
      h.update(`|${l.resourceId}:${l.quantity}:${l.expectedRate ?? ''}`);
    }
  }
  return h.digest('hex');
}

/**
 * Apply the authenticated user's signature to a purchase order.
 * Requires project access (OWNER/PM/ACCOUNTANT).
 */
export async function signPurchaseOrder(
  companyId: string,
  userId: string,
  role: string,
  userName: string,
  poId: string,
  ipAddress?: string,
) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, companyId },
    include: { lines: true },
  });
  if (!po) throw ApiError.notFound('Purchase order not found');
  await assertProjectAccess(companyId, userId, role as never, po.projectId);

  const hash = hashDocument({
    kind: 'PO',
    record: {
      id: po.id,
      poNumber: po.poNumber,
      vendorName: po.vendorName,
      totalAmount: po.totalAmount,
      projectId: po.projectId,
      companyId: po.companyId,
      lines: po.lines.map((l) => ({ resourceId: l.resourceId, quantity: l.quantity, rate: l.rate })),
    },
  });

  const updated = await prisma.purchaseOrder.update({
    where: { id: poId },
    data: {
      signedBy: userId,
      signedAt: new Date(),
      signedByName: userName,
      signatureHash: hash,
    },
  });

  await recordAudit({
    companyId,
    userId,
    action: 'CUSTOM',
    entityType: 'po_signature',
    entityId: poId,
    newValue: { signedByName: userName, signatureHash: hash },
    ipAddress,
  });

  return updated;
}

/**
 * Apply the authenticated user's signature to a material requisition (indent).
 */
export async function signRequisition(
  companyId: string,
  userId: string,
  role: string,
  userName: string,
  requisitionId: string,
  ipAddress?: string,
) {
  const req = await prisma.materialRequisition.findFirst({
    where: { id: requisitionId, companyId },
    include: { lines: true },
  });
  if (!req) throw ApiError.notFound('Requisition not found');
  await assertProjectAccess(companyId, userId, role as never, req.projectId);

  const hash = hashDocument({
    kind: 'REQUISITION',
    record: {
      id: req.id,
      reqNumber: req.reqNumber,
      projectId: req.projectId,
      companyId: req.companyId,
      lines: req.lines.map((l) => ({ resourceId: l.resourceId, quantity: l.quantity, expectedRate: l.expectedRate })),
    },
  });

  const updated = await prisma.materialRequisition.update({
    where: { id: requisitionId },
    data: {
      signedBy: userId,
      signedAt: new Date(),
      signedByName: userName,
      signatureHash: hash,
    },
  });

  await recordAudit({
    companyId,
    userId,
    action: 'CUSTOM',
    entityType: 'requisition_signature',
    entityId: requisitionId,
    newValue: { signedByName: userName, signatureHash: hash },
    ipAddress,
  });

  return updated;
}

/**
 * Verify a document's current content against its stored signature hash.
 * Returns { valid: true } if the document is unchanged since signing, or
 * { valid: false, reason } if it was edited after signing.
 */
export async function verifyPoSignature(companyId: string, poId: string) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, companyId },
    include: { lines: true },
  });
  if (!po) throw ApiError.notFound('Purchase order not found');
  if (!po.signatureHash || !po.signedAt) {
    return { signed: false as const };
  }
  const current = hashDocument({
    kind: 'PO',
    record: {
      id: po.id,
      poNumber: po.poNumber,
      vendorName: po.vendorName,
      totalAmount: po.totalAmount,
      projectId: po.projectId,
      companyId: po.companyId,
      lines: po.lines.map((l) => ({ resourceId: l.resourceId, quantity: l.quantity, rate: l.rate })),
    },
  });
  return {
    signed: true as const,
    valid: current === po.signatureHash,
    signedBy: po.signedBy,
    signedByName: po.signedByName,
    signedAt: po.signedAt,
  };
}