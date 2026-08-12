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
import type { CreateSalesReturnInput, CreatePurchaseReturnInput } from '@buildflow/shared';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function resolveDefaultProject(companyId: string, userId: string, role: string) {
  const projectId = await getDefaultProjectId(companyId);
  if (!projectId) throw ApiError.forbidden('Returns are not available on this plan.');
  await assertProjectAccess(companyId, userId, role as never, projectId);
  return projectId;
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
    select: { id: true, clientName: true, customerId: true, clientState: true, clientGstin: true },
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

  return prisma.$transaction(async (tx) => {
    const location = await getOrCreateProjectStockLocation(companyId, projectId, tx);
    const ret = await tx.salesReturn.create({
      data: {
        companyId,
        projectId,
        returnNumber: await nextSequentialNumber(companyId, 'sales-return'),
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        customerName: invoice.clientName,
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
      if (l.returnKind !== 'GOOD') continue;
      const balance = await tx.stockBalance.findUnique({
        where: { locationId_resourceId: { locationId: location.id, resourceId: l.resourceId } },
      });
      const qty = Number(l.quantity);
      // INVENTORY_HORIZONTAL_PLATFORM (Phase 5.2): restock at the current WAC —
      // this keeps the running average unchanged (WAC-neutral return).
      const res = await tx.resource.findUnique({
        where: { id: l.resourceId },
        select: { avgCost: true },
      });
      const unitCost = Number(res?.avgCost ?? 0);
      await tx.stockMovement.create({
        data: {
          locationId: location.id,
          resourceId: l.resourceId,
          quantity: qty,
          type: 'IN',
          referenceType: 'SALES_RETURN',
          referenceId: ret.id,
          notes: `Sales return ${ret.returnNumber}`,
          unitCost,
          inventoryValue: round2(unitCost * qty),
        },
      });
      if (!balance) {
        await tx.stockBalance.create({
          data: { locationId: location.id, resourceId: l.resourceId, quantity: qty },
        });
      } else {
        await tx.stockBalance.update({ where: { id: balance.id }, data: { quantity: { increment: qty } } });
      }
      await updateWacOnIn(tx, l.resourceId, balance ? Number(balance.quantity) : 0, qty, unitCost);
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
        // INVENTORY_HORIZONTAL_PLATFORM (Phase 5.5): GST state split.
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
          `${l.itemName}: only ${onHand} on hand, return requires ${qty} — purchase return aborted.`,
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
