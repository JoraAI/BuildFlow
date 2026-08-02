/**
 * BuildFlow - Petty Cash / Site Expenses service (Phase 5 §8.9).
 *
 * Tenant-scoped CRUD with project association, receipt tracking, and
 * categorized reconciliation.
 */
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { recordAudit } from '../utils/audit';
import { nextSequentialNumber } from '../lib/id-generator';
import { assertStatusTransition, PETTY_CASH_STATUS_TRANSITIONS } from '../lib/status-transition';
import type {
  CreatePettyCashEntryInput,
  UpdatePettyCashEntryInput,
  PettyCashQueryInput,
} from '@buildflow/shared';

export interface PettyCashListItem {
  id: string;
  entryNumber: string;
  description: string;
  category: string;
  amount: number;
  expenseDate: Date;
  paidTo: string;
  receiptUrl: string | null;
  notes: string | null;
  status: string;
  project: { id: string; name: string } | null;
}

export async function listPettyCashEntries(
  companyId: string,
  query: PettyCashQueryInput,
): Promise<{ rows: PettyCashListItem[]; total: number }> {
  const { page, limit, projectId, status, category } = query;
  const where: Record<string, unknown> = { companyId };
  if (projectId) where.projectId = projectId;
  if (status) where.status = status;
  if (category) where.category = category;

  const [rows, total] = await Promise.all([
    prisma.pettyCashEntry.findMany({
      where,
      orderBy: { expenseDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { project: { select: { id: true, name: true } } },
    }),
    prisma.pettyCashEntry.count({ where }),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      entryNumber: r.entryNumber,
      description: r.description,
      category: r.category,
      amount: Number(r.amount),
      expenseDate: r.expenseDate,
      paidTo: r.paidTo,
      receiptUrl: r.receiptUrl,
      notes: r.notes,
      status: r.status,
      project: r.project,
    })),
    total,
  };
}

export async function getPettyCashEntry(companyId: string, id: string) {
  const entry = await prisma.pettyCashEntry.findFirst({
    where: { id, companyId },
    include: { project: { select: { id: true, name: true } } },
  });
  if (!entry) throw ApiError.notFound('Petty cash entry not found');
  return entry;
}

export async function createPettyCashEntry(
  companyId: string,
  userId: string,
  input: CreatePettyCashEntryInput,
  ipAddress?: string,
) {
  // Validate project belongs to company if provided
  if (input.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, companyId, isDeleted: false },
      select: { id: true },
    });
    if (!project) throw ApiError.notFound('Project not found');
  }

  const entryNumber = await nextSequentialNumber(companyId, 'petty-cash');

  const entry = await prisma.pettyCashEntry.create({
    data: {
      companyId,
      projectId: input.projectId ?? null,
      entryNumber,
      description: input.description,
      category: input.category,
      amount: input.amount,
      expenseDate: new Date(input.expenseDate),
      paidTo: input.paidTo,
      receiptUrl: input.receiptUrl ?? null,
      notes: input.notes ?? null,
      status: 'PENDING',
      recordedBy: userId,
    },
    include: { project: { select: { id: true, name: true } } },
  });

  await recordAudit({
    companyId,
    userId,
    action: 'CREATE',
    entityType: 'petty_cash_entry',
    entityId: entry.id,
    newValue: { entryNumber: entry.entryNumber, amount: Number(entry.amount) },
    ipAddress,
  });

  return entry;
}

export async function updatePettyCashEntry(
  companyId: string,
  userId: string,
  id: string,
  input: UpdatePettyCashEntryInput,
  ipAddress?: string,
) {
  const existing = await getPettyCashEntry(companyId, id);
  if (input.status !== undefined && input.status !== existing.status) {
    assertStatusTransition(existing.status, input.status, PETTY_CASH_STATUS_TRANSITIONS, 'Petty cash entry');
  }

  const updated = await prisma.pettyCashEntry.update({
    where: { id },
    data: {
      ...(input.description !== undefined && { description: input.description }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.amount !== undefined && { amount: input.amount }),
      ...(input.expenseDate !== undefined && { expenseDate: new Date(input.expenseDate) }),
      ...(input.paidTo !== undefined && { paidTo: input.paidTo }),
      ...(input.receiptUrl !== undefined && { receiptUrl: input.receiptUrl }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.status !== undefined && { status: input.status }),
    },
    include: { project: { select: { id: true, name: true } } },
  });

  await recordAudit({
    companyId,
    userId,
    action: 'UPDATE',
    entityType: 'petty_cash_entry',
    entityId: id,
    oldValue: { amount: Number(existing.amount), status: existing.status },
    newValue: { amount: Number(updated.amount), status: updated.status },
    ipAddress,
  });

  return updated;
}

export async function deletePettyCashEntry(
  companyId: string,
  userId: string,
  id: string,
  ipAddress?: string,
) {
  await getPettyCashEntry(companyId, id);
  await prisma.pettyCashEntry.delete({ where: { id } });

  await recordAudit({
    companyId,
    userId,
    action: 'DELETE',
    entityType: 'petty_cash_entry',
    entityId: id,
    ipAddress,
  });
}

/**
 * Summary for reconciliation: total by status and category.
 */
export async function getPettyCashSummary(companyId: string, projectId?: string) {
  const where: Record<string, unknown> = { companyId };
  if (projectId) where.projectId = projectId;

  const entries = await prisma.pettyCashEntry.findMany({
    where,
    select: { amount: true, status: true, category: true },
  });

  const byStatus = { PENDING: 0, RECONCILED: 0, REJECTED: 0 };
  const byCategory: Record<string, number> = {};
  let total = 0;

  for (const e of entries) {
    const amt = Number(e.amount);
    total += amt;
    if (e.status in byStatus) (byStatus as Record<string, number>)[e.status] += amt;
    byCategory[e.category] = (byCategory[e.category] ?? 0) + amt;
  }

  return { total, byStatus, byCategory, count: entries.length };
}