/**
 * BuildFlow - Sequential ID generator.
 *
 * Generates human-readable, prefixed sequential numbers for entities:
 *   IND-2025-0001  (indent/requisition)
 *   BILL-2025-0001 (bill)
 *   INV-2025-0001  (invoice)
 *   PO-2025-0001   (purchase order)
 *   GRN-2025-0001  (goods receipt note)
 *
 * Uses a count-based approach scoped to company + current year.
 */
import { prisma } from './prisma';

type EntityType = 'indent' | 'bill' | 'invoice' | 'po' | 'grn';

const PREFIXES: Record<EntityType, string> = {
  indent: 'IND',
  bill: 'BILL',
  invoice: 'INV',
  po: 'PO',
  grn: 'GRN',
};

/**
 * Generate the next sequential number for the given entity type.
 * Format: {PREFIX}-{YYYY}-{NNNN}
 * Scoped per-company, resets each calendar year.
 */
export async function nextSequentialNumber(
  companyId: string,
  type: EntityType,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = PREFIXES[type];

  let count: number;
  switch (type) {
    case 'indent':
      count = await prisma.materialRequisition.count({
        where: {
          companyId,
          reqNumber: { startsWith: `${prefix}-${year}-` },
        },
      });
      break;
    case 'bill':
      count = await prisma.bill.count({
        where: {
          companyId,
          billNumber: { startsWith: `${prefix}-${year}-` },
        },
      });
      break;
    case 'invoice':
      count = await prisma.invoice.count({
        where: {
          companyId,
          invoiceNumber: { startsWith: `${prefix}-${year}-` },
        },
      });
      break;
    case 'po':
      count = await prisma.purchaseOrder.count({
        where: {
          companyId,
          poNumber: { startsWith: `${prefix}-${year}-` },
        },
      });
      break;
    case 'grn':
      count = await prisma.goodsReceiptNote.count({
        where: {
          companyId,
          grnNumber: { startsWith: `${prefix}-${year}-` },
        },
      });
      break;
  }

  const seq = String(count + 1).padStart(4, '0');
  return `${prefix}-${year}-${seq}`;
}