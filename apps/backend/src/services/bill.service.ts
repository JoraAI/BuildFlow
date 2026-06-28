/**
 * BuildFlow - Bill (vendor invoice) service.
 */
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { round2 } from './gst.service';
import type { CreateBillInput, UpdateBillInput } from '@buildflow/shared';

function toNum(d: Decimal | null | undefined): number {
  return d ? Number(d) : 0;
}

export interface BillListItem {
  id: string;
  billNumber: string;
  vendorName: string;
  billDate: Date;
  dueDate: Date | null;
  status: string;
  subtotal: number;
  gstAmount: number;
  tdsAmount: number;
  total: number;
  category: string;
  attachmentUrl: string | null;
  project: { id: string; name: string };
}

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
  return bills.map((b) => ({
    id: b.id,
    billNumber: b.billNumber,
    vendorName: b.vendorName,
    billDate: b.billDate,
    dueDate: b.dueDate,
    status: b.status,
    subtotal: toNum(b.subtotal),
    gstAmount: toNum(b.gstAmount),
    tdsAmount: toNum(b.tdsAmount),
    total: toNum(b.total),
    category: b.category,
    attachmentUrl: b.attachmentUrl,
    project: b.project,
  }));
}

export async function getBill(companyId: string, id: string) {
  const bill = await prisma.bill.findFirst({
    where: { id, companyId },
    include: { project: { select: { id: true, name: true } } },
  });
  if (!bill) throw ApiError.notFound('Bill');
  return bill;
}

export async function createBill(companyId: string, _userId: string, input: CreateBillInput) {
  const project = await prisma.project.findFirst({
    where: { id: input.projectId, companyId },
  });
  if (!project) throw ApiError.notFound('Project');

  const total = round2(input.subtotal + input.gstAmount - input.tdsAmount);

  return prisma.bill.create({
    data: {
      projectId: input.projectId,
      companyId,
      billNumber: input.billNumber,
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
    },
    include: { project: { select: { id: true, name: true } } },
  });
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

  return prisma.bill.update({
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
}

export async function approveBill(companyId: string, userId: string, id: string) {
  const bill = await prisma.bill.findFirst({ where: { id, companyId } });
  if (!bill) throw ApiError.notFound('Bill');
  if (bill.status === 'PAID') throw ApiError.conflict('Bill already paid');

  return prisma.bill.update({
    where: { id },
    data: { status: 'APPROVED', approvedBy: userId },
  });
}

export async function rejectBill(companyId: string, _userId: string, id: string) {
  const bill = await prisma.bill.findFirst({ where: { id, companyId } });
  if (!bill) throw ApiError.notFound('Bill');
  if (bill.status === 'PAID') throw ApiError.conflict('Cannot reject a paid bill');

  return prisma.bill.update({
    where: { id },
    data: { status: 'REJECTED' },
  });
}

export async function payBill(companyId: string, userId: string, id: string) {
  const bill = await prisma.bill.findFirst({ where: { id, companyId } });
  if (!bill) throw ApiError.notFound('Bill');
  if (bill.status !== 'APPROVED') {
    throw ApiError.conflict('Bill must be approved before marking as paid');
  }

  const updated = await prisma.bill.update({
    where: { id },
    data: { status: 'PAID' },
  });

  // Create journal entry for payment
  await prisma.journalEntry.create({
    data: {
      companyId,
      projectId: bill.projectId,
      entryDate: new Date(),
      description: `Payment to vendor for bill ${bill.billNumber}`,
      reference: bill.billNumber,
      debitAccount: 'Accounts Payable',
      creditAccount: 'Bank/Cash',
      amount: Number(bill.total),
      createdBy: userId,
    },
  });

  return updated;
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
    select: { category: true, status: true, total: true },
  });

  const byCategory: Record<string, { total: number; count: number }> = {};
  let pendingCount = 0;
  let pendingAmount = 0;
  let totalSpend = 0;

  for (const b of bills) {
    const total = Number(b.total);
    const cat = b.category;
    if (!byCategory[cat]) byCategory[cat] = { total: 0, count: 0 };
    byCategory[cat].total += total;
    byCategory[cat].count += 1;
    totalSpend += total;
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
    billCount: bills.length,
  };
}