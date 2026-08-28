/**
 * BuildFlow - Sales/Purchase returns + credit/debit notes service
 * (INVENTORY_HORIZONTAL_PLATFORM Phase 2.2/2.3/2.4).
 *
 * Sales return: GOOD lines restock (IN), DAMAGED lines are scrapped (no stock);
 * creates a DRAFT credit note (GST-aware). Purchase return: stock OUT to vendor;
 * creates a DRAFT debit note.
 */
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { nextSequentialNumber } from '../lib/id-generator';
import { assertProjectAccess } from '../middleware/project-access.middleware';
import { getDefaultProjectId } from './module-gate.service';
import { getOrCreateProjectStockLocation } from './procurement.service';
import { updateWacOnIn } from './finance.service';
import { splitGstByState } from './finance.service';
import { applyBatchIn, isBatchTracked } from './stock-batch.service';
import type {
  CreateSalesReturnInput,
  CreatePurchaseReturnInput,
  ValidateReturnScanInput,
  ApproveSalesReturnInput,
} from '@buildflow/shared';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function resolveDefaultProject(companyId: string, userId: string, role: string) {
  const projectId = await getDefaultProjectId(companyId);
  if (!projectId) throw ApiError.forbidden('Returns are not available on this plan.');
  await assertProjectAccess(companyId, userId, role as never, projectId);
  return projectId;
}

/**
 * Validates a barcode / SKU scanned at POS counter during return.
 * Matches against a specific invoice, customer, or latest outbound dispatches.
 */
export async function validateReturnScan(
  companyId: string,
  userId: string,
  role: string,
  input: ValidateReturnScanInput,
) {
  const projectId = await resolveDefaultProject(companyId, userId, role);
  const q = input.barcode.trim();

  const orConditions: Array<Record<string, unknown>> = [
    { barcode: q },
    { itemCode: q },
    { sku: q },
    { name: { equals: q, mode: 'insensitive' } },
  ];
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q)) {
    orConditions.push({ id: q });
  }

  // Find resource by barcode, itemCode, SKU, or ID
  const resource = await prisma.resource.findFirst({
    where: {
      companyId,
      OR: orConditions,
    },
  });

  if (!resource) {
    throw ApiError.notFound(`No item found matching barcode/code "${input.barcode}"`);
  }

  // Look up invoices containing this resource
  const invoiceWhere: Record<string, unknown> = {
    companyId,
    projectId,
    status: { in: ['SENT', 'PAID', 'OVERDUE'] },
  };
  if (input.invoiceId) {
    invoiceWhere.id = input.invoiceId;
  }
  if (input.customerId) {
    invoiceWhere.customerId = input.customerId;
  }

  const matchingInvoices = await prisma.invoice.findMany({
    where: invoiceWhere,
    orderBy: { invoiceDate: 'desc' },
    take: 10,
    include: {
      lineItems: {
        where: { resourceId: resource.id },
      },
    },
  });

  const matchingLines = matchingInvoices.flatMap((inv) =>
    inv.lineItems.map((l) => ({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      clientName: inv.clientName,
      invoiceDate: inv.invoiceDate ? inv.invoiceDate.toISOString() : new Date().toISOString(),
      invoiceLineItemId: l.id,
      dispatchedQty: Number(l.quantity),
      rate: Number(l.rate),
      gstRate: Number(l.gstRate ?? 18),
      amount: Number(l.amount),
    })),
  );

  // Check previous returns for this resource across these invoices
  const prevReturns = await prisma.salesReturnLine.findMany({
    where: {
      resourceId: resource.id,
      salesReturn: {
        companyId,
        invoiceId: input.invoiceId ? input.invoiceId : { in: matchingInvoices.map((i) => i.id) },
        status: { in: ['DRAFT', 'ISSUED'] },
      },
    },
    select: {
      quantity: true,
      salesReturnId: true,
      invoiceLineItemId: true,
    },
  });

  const totalPreviouslyReturned = prevReturns.reduce((sum, r) => sum + Number(r.quantity), 0);
  const totalDispatched = matchingLines.reduce((sum, l) => sum + l.dispatchedQty, 0);
  const maxReturnable = Math.max(0, totalDispatched - totalPreviouslyReturned);

  return {
    resource: {
      id: resource.id,
      name: resource.name,
      unit: resource.unit,
      barcode: resource.barcode,
      sku: resource.sku,
      itemCode: resource.itemCode,
      catalogRate: Number(resource.rate ?? 0),
    },
    matchingLines,
    totalDispatched,
    totalPreviouslyReturned,
    maxReturnable,
    isValidDispatch: matchingLines.length > 0,
  };
}

export async function createSalesReturn(
  companyId: string,
  userId: string,
  role: string,
  input: CreateSalesReturnInput,
) {
  const projectId = await resolveDefaultProject(companyId, userId, role);
  const invoice = await prisma.invoice.findFirst({
    where: { id: input.invoiceId, companyId },
    select: {
      id: true,
      clientName: true,
      customerId: true,
      clientState: true,
      clientGstin: true,
      // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.2): sale-movement link for
      // restoring GOOD returns to the exact lot sold.
      stockMovementId: true,
    },
  });
  if (!invoice) throw ApiError.notFound('Invoice not found');
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 5.5): same-state → CGST/SGST, else IGST.
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { state: true, gstin: true },
  });

  let subtotal = 0;
  let gstAmount = 0;
  const lines = input.lines.map((l) => {
    const amount = round2(l.quantity * l.rate);
    const gstRate = l.gstRate ?? 18;
    subtotal += amount;
    gstAmount += round2(amount * (gstRate / 100));
    return {
      invoiceLineItemId: l.invoiceLineItemId ?? null,
      resourceId: l.resourceId,
      itemName: '',
      unit: l.unit,
      quantity: l.quantity,
      returnKind: l.returnKind ?? 'GOOD',
      rate: l.rate,
      amount,
      gstRate,
    };
  });
  const total = round2(subtotal + gstAmount);
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 5.5): same-state → CGST/SGST, else IGST.
  const gstSplit = splitGstByState(company.state, company.gstin, invoice.clientState, invoice.clientGstin, gstAmount);

  const resources = await prisma.resource.findMany({
    where: { id: { in: lines.map((l) => l.resourceId) }, companyId },
    select: { id: true, name: true },
  });
  const nameById = new Map(resources.map((r) => [r.id, r.name]));
  for (const l of lines) {
    const name = nameById.get(l.resourceId);
    if (!name) throw ApiError.notFound('Resource not found');
    l.itemName = name;
  }

  const initialStatus = input.status === 'DRAFT' || input.status === 'PENDING_APPROVAL' ? 'DRAFT' : 'ISSUED';

  return prisma.$transaction(async (tx) => {
    const location = input.targetLocationId
      ? await tx.stockLocation.findFirst({ where: { id: input.targetLocationId, companyId } }) ?? await getOrCreateProjectStockLocation(companyId, projectId, tx)
      : await getOrCreateProjectStockLocation(companyId, projectId, tx);

    const ret = await tx.salesReturn.create({
      data: {
        companyId,
        projectId,
        returnNumber: await nextSequentialNumber(companyId, 'sales-return'),
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        customerName: invoice.clientName,
        returnDate: input.returnDate,
        status: initialStatus,
        reason: input.reason?.trim() || null,
        subtotal,
        gstAmount,
        total,
        createdBy: userId,
        lines: { create: lines },
      },
      include: { lines: true },
    });

    if (initialStatus === 'ISSUED') {
      await restockSalesReturnLines(tx, location.id, ret, invoice);
    }

    const creditNote = await tx.creditNote.create({
      data: {
        companyId,
        projectId,
        creditNoteNumber: await nextSequentialNumber(companyId, 'credit-note'),
        invoiceId: invoice.id,
        salesReturnId: ret.id,
        customerId: invoice.customerId,
        customerName: invoice.clientName,
        creditDate: input.returnDate,
        status: 'DRAFT',
        subtotal,
        gstAmount,
        cgstAmount: gstSplit.cgst,
        sgstAmount: gstSplit.sgst,
        igstAmount: gstSplit.igst,
        total,
        notes: `Auto from sales return ${ret.returnNumber}`,
        createdBy: userId,
        lines: {
          create: ret.lines.map((l) => ({
            resourceId: l.resourceId,
            description: l.itemName,
            quantity: Number(l.quantity),
            unit: l.unit,
            rate: Number(l.rate),
            amount: Number(l.amount),
            gstRate: Number(l.gstRate),
          })),
        },
      },
    });

    return { salesReturn: ret, creditNoteId: creditNote.id };
  });
}

/**
 * Owner 1-click approval for a pending sales return voucher.
 * Adds items to target warehouse stock and finalizes credit note.
 */
export async function approveSalesReturn(
  companyId: string,
  userId: string,
  role: string,
  returnId: string,
  input?: ApproveSalesReturnInput,
) {
  const projectId = await resolveDefaultProject(companyId, userId, role);
  const ret = await prisma.salesReturn.findFirst({
    where: { id: returnId, companyId },
    include: { lines: true, invoice: true, creditNote: true },
  });
  if (!ret) throw ApiError.notFound('Sales return not found');
  if (ret.status === 'ISSUED') {
    return { salesReturn: ret, alreadyApproved: true };
  }

  return prisma.$transaction(async (tx) => {
    const location = input?.targetLocationId
      ? (await tx.stockLocation.findFirst({ where: { id: input.targetLocationId, companyId } })) ?? (await getOrCreateProjectStockLocation(companyId, projectId, tx))
      : await getOrCreateProjectStockLocation(companyId, projectId, tx);

    if (ret.invoice) {
      await restockSalesReturnLines(tx, location.id, ret, ret.invoice);
    }

    const updated = await tx.salesReturn.update({
      where: { id: ret.id },
      data: {
        status: 'ISSUED',
        reason: input?.notes ? `${ret.reason ?? ''} | Approved: ${input.notes}`.trim() : ret.reason,
      },
      include: { lines: true },
    });

    if (ret.creditNote) {
      await tx.creditNote.update({
        where: { id: ret.creditNote.id },
        data: { status: 'ISSUED' },
      });
    }

    return { salesReturn: updated, approved: true };
  });
}

async function restockSalesReturnLines(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  locationId: string,
  ret: { id: string; returnNumber: string; lines: Array<{ resourceId: string; quantity: unknown; returnKind: string }> },
  invoice: { id: string; stockMovementId?: string | null },
) {
  for (const l of ret.lines) {
    if (l.returnKind !== 'GOOD') continue;
    const balance = await tx.stockBalance.findUnique({
      where: { locationId_resourceId: { locationId, resourceId: l.resourceId } },
    });
    const qty = Number(l.quantity);
    const res = await tx.resource.findUnique({
      where: { id: l.resourceId },
      select: { avgCost: true, trackingMode: true },
    });
    const unitCost = Number(res?.avgCost ?? 0);

    let batchCode: string | null = null;
    if (isBatchTracked(res?.trackingMode)) {
      if (invoice.stockMovementId) {
        const orig = await tx.stockMovement.findUnique({
          where: { id: invoice.stockMovementId },
          select: { resourceId: true, batchCode: true },
        });
        if (orig && orig.resourceId === l.resourceId && orig.batchCode) {
          batchCode = orig.batchCode;
        }
      }
      batchCode = batchCode ?? `RET-${Date.now()}`;
      await applyBatchIn(tx, {
        locationId,
        resourceId: l.resourceId,
        batchCode,
        quantity: qty,
      });
    }

    await tx.stockMovement.create({
      data: {
        locationId,
        resourceId: l.resourceId,
        quantity: qty,
        type: 'IN',
        referenceType: 'SALES_RETURN',
        referenceId: ret.id,
        notes: `Sales return ${ret.returnNumber}`,
        unitCost,
        inventoryValue: round2(unitCost * qty),
        batchCode,
      },
    });

    if (!balance) {
      await tx.stockBalance.create({
        data: { locationId, resourceId: l.resourceId, quantity: qty },
      });
    } else {
      await tx.stockBalance.update({
        where: { id: balance.id },
        data: { quantity: { increment: qty } },
      });
    }
    await updateWacOnIn(tx, l.resourceId, balance ? Number(balance.quantity) : 0, qty, unitCost);
  }
}

export async function listSalesReturns(companyId: string, userId: string, role: string) {
  await resolveDefaultProject(companyId, userId, role);
  return prisma.salesReturn.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    include: { lines: true, creditNote: { select: { id: true, creditNoteNumber: true } } },
  });
}

export async function listCreditNotes(companyId: string, userId: string, role: string) {
  await resolveDefaultProject(companyId, userId, role);
  return prisma.creditNote.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    include: { lines: true, salesReturn: { select: { id: true, returnNumber: true } } },
  });
}

export async function createPurchaseReturn(
  companyId: string,
  userId: string,
  role: string,
  input: CreatePurchaseReturnInput,
) {
  const projectId = await resolveDefaultProject(companyId, userId, role);
  const bill = input.billId
    ? await prisma.bill.findFirst({ where: { id: input.billId, companyId } })
    : null;
  if (input.billId && !bill) throw ApiError.notFound('Bill not found');

  let subtotal = 0;
  let gstAmount = 0;
  const lines = input.lines.map((l) => {
    const amount = round2(l.quantity * l.rate);
    const gstRate = l.gstRate ?? 18;
    subtotal += amount;
    gstAmount += round2(amount * (gstRate / 100));
    return {
      goodsReceiptLineId: l.goodsReceiptLineId ?? null,
      resourceId: l.resourceId,
      itemName: '',
      unit: l.unit,
      quantity: l.quantity,
      rate: l.rate,
      amount,
      gstRate,
    };
  });
  const total = round2(subtotal + gstAmount);

  const resources = await prisma.resource.findMany({
    where: { id: { in: lines.map((l) => l.resourceId) }, companyId },
    select: { id: true, name: true },
  });
  const nameById = new Map(resources.map((r) => [r.id, r.name]));
  for (const l of lines) {
    const name = nameById.get(l.resourceId);
    if (!name) throw ApiError.notFound('Resource not found');
    l.itemName = name;
  }

  const vendorName = bill?.vendorName ?? 'Vendor';
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 5.5): same-state → CGST/SGST, else IGST.
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { state: true, gstin: true },
  });
  const gstSplit = splitGstByState(company.state, company.gstin, null, bill?.vendorGstin ?? null, gstAmount);

  return prisma.$transaction(async (tx) => {
    const location = await getOrCreateProjectStockLocation(companyId, projectId, tx);
    const ret = await tx.purchaseReturn.create({
      data: {
        companyId,
        projectId,
        returnNumber: await nextSequentialNumber(companyId, 'purchase-return'),
        billId: bill?.id ?? null,
        grnId: input.grnId ?? null,
        vendorId: bill?.vendorId ?? null,
        vendorName,
        returnDate: input.returnDate,
        status: 'ISSUED',
        reason: input.reason?.trim() || null,
        subtotal,
        gstAmount,
        total,
        createdBy: userId,
        lines: { create: lines },
      },
      include: { lines: true },
    });

    for (const l of ret.lines) {
      const balance = await tx.stockBalance.findUnique({
        where: { locationId_resourceId: { locationId: location.id, resourceId: l.resourceId } },
      });
      const onHand = balance ? Number(balance.quantity) : 0;
      const qty = Number(l.quantity);
      if (!balance || onHand < qty) {
        throw ApiError.unprocessable(
          `${l.itemName}: only ${onHand} on hand, return requires ${qty} - purchase return aborted.`,
        );
      }
      await tx.stockBalance.update({ where: { id: balance.id }, data: { quantity: { decrement: qty } } });
      const res = await tx.resource.findUnique({
        where: { id: l.resourceId },
        select: { avgCost: true },
      });
      await tx.stockMovement.create({
        data: {
          locationId: location.id,
          resourceId: l.resourceId,
          quantity: qty,
          type: 'OUT',
          referenceType: 'PURCHASE_RETURN',
          referenceId: ret.id,
          notes: `Purchase return ${ret.returnNumber}`,
          // INVENTORY_HORIZONTAL_PLATFORM (Phase 5.2): cost at WAC.
          unitCost: Number(res?.avgCost ?? 0),
          inventoryValue: round2(Number(res?.avgCost ?? 0) * qty),
        },
      });
    }

    const debitNote = await tx.debitNote.create({
      data: {
        companyId,
        projectId,
        debitNoteNumber: await nextSequentialNumber(companyId, 'debit-note'),
        billId: bill?.id ?? null,
        purchaseReturnId: ret.id,
        vendorId: bill?.vendorId ?? null,
        vendorName,
        debitDate: input.returnDate,
        status: 'DRAFT',
        subtotal,
        gstAmount,
        // INVENTORY_HORIZONTAL_PLATFORM (Phase 5.5): GST state split.
        cgstAmount: gstSplit.cgst,
        sgstAmount: gstSplit.sgst,
        igstAmount: gstSplit.igst,
        total,
        notes: `Auto from purchase return ${ret.returnNumber}`,
        createdBy: userId,
        lines: {
          create: ret.lines.map((l) => ({
            resourceId: l.resourceId,
            description: l.itemName,
            quantity: Number(l.quantity),
            unit: l.unit,
            rate: Number(l.rate),
            amount: Number(l.amount),
            gstRate: Number(l.gstRate),
          })),
        },
      },
    });

    return { purchaseReturn: ret, debitNoteId: debitNote.id };
  });
}

export async function listPurchaseReturns(companyId: string, userId: string, role: string) {
  await resolveDefaultProject(companyId, userId, role);
  return prisma.purchaseReturn.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    include: { lines: true, debitNote: { select: { id: true, debitNoteNumber: true } } },
  });
}

export async function listDebitNotes(companyId: string, userId: string, role: string) {
  await resolveDefaultProject(companyId, userId, role);
  return prisma.debitNote.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    include: { lines: true, purchaseReturn: { select: { id: true, returnNumber: true } } },
  });
}

/**
 * INVENTORY_HORIZONTAL_PLATFORM (Phase 5.4): issue a DRAFT credit/debit note.
 * Only DRAFT → ISSUED (Tally export includes ISSUED notes). ISSUED is terminal
 * (no re-draft) for v1; a VOID action can follow if needed.
 */
export async function issueCreditNote(companyId: string, userId: string, role: string, id: string) {
  await resolveDefaultProject(companyId, userId, role);
  const cn = await prisma.creditNote.findFirst({ where: { id, companyId } });
  if (!cn) throw ApiError.notFound('Credit note not found');
  if (cn.status !== 'DRAFT') {
    throw ApiError.badRequest(`Only draft credit notes can be issued (current: ${cn.status}).`);
  }
  return prisma.creditNote.update({
    where: { id },
    data: { status: 'ISSUED' },
    include: { lines: true },
  });
}

export async function issueDebitNote(companyId: string, userId: string, role: string, id: string) {
  await resolveDefaultProject(companyId, userId, role);
  const dn = await prisma.debitNote.findFirst({ where: { id, companyId } });
  if (!dn) throw ApiError.notFound('Debit note not found');
  if (dn.status !== 'DRAFT') {
    throw ApiError.badRequest(`Only draft debit notes can be issued (current: ${dn.status}).`);
  }
  return prisma.debitNote.update({
    where: { id },
    data: { status: 'ISSUED' },
    include: { lines: true },
  });
}
