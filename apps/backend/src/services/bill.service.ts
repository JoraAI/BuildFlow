/**
 * BuildFlow - Bill (vendor invoice) service.
 */
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { invalidateCache, cacheKeys } from '../utils/cache';
import { round2 } from './gst.service';
import { nextSequentialNumber } from '../lib/id-generator';
import type { CreateBillInput, UpdateBillInput, RecordPaymentInput } from '@buildflow/shared';

function toNum(d: Decimal | null | undefined): number {
  return d ? Number(d) : 0;
}

async function invalidateBillSummaryCache(companyId: string, projectId: string) {
  await invalidateCache(cacheKeys.projectSummary(companyId, projectId), cacheKeys.dashboard(companyId));
}

function serializeBill(b: {
  id: string;
  projectId: string;
  billNumber: string;
  vendorName: string;
  vendorGstin: string | null;
  billDate: Date;
  dueDate: Date | null;
  status: string;
  subtotal: Decimal;
  gstAmount: Decimal;
  tdsRate: Decimal;
  tdsAmount: Decimal;
  total: Decimal;
  category: string;
  attachmentUrl: string | null;
  paidAmount: Decimal;
  paidAt: Date | null;
  retentionAmount: Decimal;
  advanceRecoveryAmount: Decimal;
  workOrderId: string | null;
  measurementId: string | null;
  isRetentionRelease: boolean;
  project?: { id: string; name: string };
}) {
  return {
    id: b.id,
    projectId: b.projectId,
    billNumber: b.billNumber,
    vendorName: b.vendorName,
    vendorGstin: b.vendorGstin,
    billDate: b.billDate,
    dueDate: b.dueDate,
    status: b.status,
    subtotal: toNum(b.subtotal),
    gstAmount: toNum(b.gstAmount),
    tdsRate: toNum(b.tdsRate),
    tdsAmount: toNum(b.tdsAmount),
    total: toNum(b.total),
    category: b.category,
    attachmentUrl: b.attachmentUrl,
    paidAmount: toNum(b.paidAmount),
    paidAt: b.paidAt,
    retentionAmount: toNum(b.retentionAmount),
    advanceRecoveryAmount: toNum(b.advanceRecoveryAmount),
    workOrderId: b.workOrderId,
    measurementId: b.measurementId,
    isRetentionRelease: b.isRetentionRelease,
    ...(b.project ? { project: b.project } : {}),
  };
}

export type BillListItem = ReturnType<typeof serializeBill>;

export async function listBills(
  companyId: string,
  projectId?: string,
  status?: string,
): Promise<BillListItem[]> {
  const where: Record<string, unknown> = { companyId };
  if (projectId) where.projectId = projectId;
  if (status) where.status = status;

  const bills = await prisma.bill.findMany({
    where,
    orderBy: { billDate: 'desc' },
    include: { project: { select: { id: true, name: true } } },
  });
  return bills.map(serializeBill);
}

export async function getBill(companyId: string, id: string) {
  const bill = await prisma.bill.findFirst({
    where: { id, companyId },
    include: { project: { select: { id: true, name: true } } },
  });
  if (!bill) throw ApiError.notFound('Bill');
  return serializeBill(bill);
}

/**
 * Build a JSON snapshot of the linked entities (PO / WO / measurement) at bill
 * creation time, so the bill's basis is preserved even if those records change
 * later. Stored on `Bill.billSnapshot`.
 */
async function buildBillSnapshot(opts: {
  purchaseOrderId?: string | null;
  workOrderId?: string | null;
  measurementId?: string | null;
}): Promise<Prisma.JsonObject | null> {
  if (!opts.purchaseOrderId && !opts.workOrderId && !opts.measurementId) return null;

  const snapshot: Prisma.JsonObject = { capturedAt: new Date().toISOString() };

  if (opts.purchaseOrderId) {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: opts.purchaseOrderId },
      select: { poNumber: true, vendorName: true, totalAmount: true, status: true },
    });
    if (po) {
      snapshot.purchaseOrder = {
        poNumber: po.poNumber,
        vendorName: po.vendorName,
        totalAmount: Number(po.totalAmount),
        status: po.status,
      };
    }
  }
  if (opts.workOrderId) {
    const wo = await prisma.subcontractWorkOrder.findUnique({
      where: { id: opts.workOrderId },
      select: {
        woNumber: true,
        scope: true,
        contractValue: true,
        retentionPct: true,
        status: true,
        subcontractor: { select: { name: true, gstin: true, defaultTdsRate: true } },
      },
    });
    if (wo) {
      snapshot.workOrder = {
        woNumber: wo.woNumber,
        scope: wo.scope,
        contractValue: Number(wo.contractValue),
        retentionPct: Number(wo.retentionPct),
        status: wo.status,
        subcontractor: {
          name: wo.subcontractor.name,
          gstin: wo.subcontractor.gstin,
          defaultTdsRate: Number(wo.subcontractor.defaultTdsRate),
        },
      };
    }
  }
  if (opts.measurementId) {
    const m = await prisma.subcontractMeasurement.findUnique({
      where: { id: opts.measurementId },
      select: { periodLabel: true, totalAmount: true, status: true },
    });
    if (m) {
      snapshot.measurement = {
        periodLabel: m.periodLabel,
        totalAmount: Number(m.totalAmount),
        status: m.status,
      };
    }
  }

  return Object.keys(snapshot).length > 1 ? snapshot : null;
}

export async function createBill(companyId: string, _userId: string, input: CreateBillInput) {
  const project = await prisma.project.findFirst({
    where: { id: input.projectId, companyId },
  });
  if (!project) throw ApiError.notFound('Project');

  const total = round2(input.subtotal + input.gstAmount - input.tdsAmount);

  // Capture a snapshot of any linked entities at creation time (audit trail).
  // Manual bills usually don't have PO/WO links, but if they do we preserve them.
  const snapshot = await buildBillSnapshot({
    purchaseOrderId: (input as CreateBillInput & { purchaseOrderId?: string }).purchaseOrderId,
    workOrderId: (input as CreateBillInput & { workOrderId?: string }).workOrderId,
    measurementId: (input as CreateBillInput & { measurementId?: string }).measurementId,
  });

  const bill = await prisma.bill.create({
    data: {
      projectId: input.projectId,
      companyId,
      billNumber: input.billNumber || await nextSequentialNumber(companyId, 'bill'),
      vendorName: input.vendorName,
      vendorGstin: input.vendorGstin,
      billDate: input.billDate,
      dueDate: input.dueDate,
      status: 'PENDING',
      subtotal: input.subtotal,
      gstAmount: input.gstAmount,
      tdsAmount: input.tdsAmount,
      total,
      category: input.category,
      ...(snapshot ? { billSnapshot: snapshot } : {}),
    },
    include: { project: { select: { id: true, name: true } } },
  });

  return serializeBill(bill);
}

export async function updateBill(
  companyId: string,
  id: string,
  input: UpdateBillInput,
) {
  const bill = await prisma.bill.findFirst({ where: { id, companyId } });
  if (!bill) throw ApiError.notFound('Bill');
  if (bill.status === 'PAID') throw ApiError.conflict('Cannot edit a paid bill');

  const subtotal = input.subtotal ?? Number(bill.subtotal);
  const gstAmount = input.gstAmount ?? Number(bill.gstAmount);
  const tdsAmount = input.tdsAmount ?? Number(bill.tdsAmount);
  const total = round2(subtotal + gstAmount - tdsAmount);

  const updated = await prisma.bill.update({
    where: { id },
    data: {
      vendorName: input.vendorName,
      vendorGstin: input.vendorGstin,
      billDate: input.billDate,
      dueDate: input.dueDate,
      subtotal,
      gstAmount,
      tdsAmount,
      total,
      category: input.category,
    },
    include: { project: { select: { id: true, name: true } } },
  });
  return serializeBill(updated);
}

export async function approveBill(companyId: string, userId: string, id: string) {
  const bill = await prisma.bill.findFirst({ where: { id, companyId } });
  if (!bill) throw ApiError.notFound('Bill');
  if (bill.status === 'PAID') throw ApiError.conflict('Bill already paid');
  if (bill.status === 'REJECTED') throw ApiError.badRequest('Rejected bills cannot be approved');

  const updated = await prisma.bill.update({
    where: { id },
    data: { status: 'APPROVED', approvedBy: userId },
    include: { project: { select: { id: true, name: true } } },
  });
  await invalidateBillSummaryCache(companyId, bill.projectId);
  return serializeBill(updated);
}

export async function rejectBill(companyId: string, _userId: string, id: string) {
  const bill = await prisma.bill.findFirst({ where: { id, companyId } });
  if (!bill) throw ApiError.notFound('Bill');
  if (bill.status === 'PAID') throw ApiError.conflict('Cannot reject a paid bill');

  const updated = await prisma.bill.update({
    where: { id },
    data: { status: 'REJECTED' },
    include: { project: { select: { id: true, name: true } } },
  });
  await invalidateBillSummaryCache(companyId, bill.projectId);
  return serializeBill(updated);
}

export async function recordBillPayment(
  companyId: string,
  userId: string,
  id: string,
  input: RecordPaymentInput,
) {
  const bill = await prisma.bill.findFirst({ where: { id, companyId } });
  if (!bill) throw ApiError.notFound('Bill');
  if (bill.status === 'REJECTED') throw ApiError.badRequest('Cannot pay a rejected bill');
  if (bill.status === 'PENDING') {
    throw ApiError.badRequest('Bill must be approved before recording payment');
  }
  if (bill.status === 'PAID' && toNum(bill.paidAmount) >= toNum(bill.total)) {
    throw ApiError.conflict('Bill already fully paid');
  }

  const newPaid = round2(toNum(bill.paidAmount) + input.amount);
  const total = toNum(bill.total);
  if (newPaid > total + 0.01) {
    throw ApiError.badRequest('Payment exceeds bill net payable');
  }

  const isFullyPaid = newPaid >= total;
  const status = isFullyPaid ? 'PAID' : 'APPROVED';

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.bill.update({
      where: { id },
      data: {
        paidAmount: newPaid,
        paidAt: isFullyPaid ? (input.paymentDate ?? new Date()) : bill.paidAt,
        status,
      },
      include: { project: { select: { id: true, name: true } } },
    });

    await tx.journalEntry.create({
      data: {
        companyId,
        projectId: bill.projectId,
        entryDate: input.paymentDate ?? new Date(),
        description: `Payment to vendor for bill ${bill.billNumber}`,
        reference: input.reference ?? bill.billNumber,
        debitAccount: 'Accounts Payable',
        creditAccount: 'Bank/Cash',
        amount: input.amount,
        createdBy: userId,
      },
    });

    return result;
  });

  await invalidateBillSummaryCache(companyId, bill.projectId);
  return serializeBill(updated);
}

export async function payBill(companyId: string, userId: string, id: string) {
  const bill = await prisma.bill.findFirst({ where: { id, companyId } });
  if (!bill) throw ApiError.notFound('Bill');
  if (bill.status !== 'APPROVED' && bill.status !== 'PAID') {
    throw ApiError.conflict('Bill must be approved before marking as paid');
  }

  const remaining = round2(toNum(bill.total) - toNum(bill.paidAmount));
  if (remaining <= 0) {
    throw ApiError.conflict('Bill already fully paid');
  }

  return recordBillPayment(companyId, userId, id, {
    amount: remaining,
    paymentDate: new Date(),
    method: 'BANK',
  });
}

export async function deleteBill(companyId: string, id: string) {
  const bill = await prisma.bill.findFirst({ where: { id, companyId } });
  if (!bill) throw ApiError.notFound('Bill');
  if (!['PENDING', 'REJECTED'].includes(bill.status)) {
    throw ApiError.conflict('Only PENDING or REJECTED bills can be deleted');
  }
  return prisma.bill.delete({ where: { id } });
}

export async function getBillSummary(companyId: string, projectId?: string) {
  const where: Record<string, unknown> = { companyId };
  if (projectId) where.projectId = projectId;

  const bills = await prisma.bill.findMany({
    where,
    select: { category: true, status: true, total: true, paidAmount: true },
  });

  const byCategory: Record<string, { total: number; count: number }> = {};
  let pendingCount = 0;
  let pendingAmount = 0;
  let totalSpend = 0;
  let totalPaid = 0;

  for (const b of bills) {
    const total = Number(b.total);
    const paid = Number(b.paidAmount);
    const cat = b.category;
    if (!byCategory[cat]) byCategory[cat] = { total: 0, count: 0 };
    byCategory[cat].total += total;
    byCategory[cat].count += 1;
    totalSpend += total;
    totalPaid += paid;
    if (b.status === 'PENDING') {
      pendingCount += 1;
      pendingAmount += total;
    }
  }

  return {
    byCategory: Object.entries(byCategory).map(([category, v]) => ({
      category,
      total: round2(v.total),
      count: v.count,
    })),
    pendingCount,
    pendingAmount: round2(pendingAmount),
    totalSpend: round2(totalSpend),
    totalPaid: round2(totalPaid),
    billCount: bills.length,
  };
}
