/**
 * BuildFlow — BOQ service.
 *
 * CRUD + CSV import + Excel export + from-estimate conversion.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { recordAudit } from '../utils/audit';
import { getProject } from './project.service';
import { EstimateStatus } from '@buildflow/shared';
import type { CreateBoqItemInput, UpdateBoqItemInput } from '@buildflow/shared';

/* ------------------------------------------------------------------ */
/* List & Get                                                          */
/* ------------------------------------------------------------------ */

export async function listBoq(companyId: string, projectId: string) {
  await getProject(companyId, projectId);
  const items = await prisma.bOQItem.findMany({
    where: { projectId, isSuperseded: false },
    orderBy: [{ category: 'asc' }, { itemCode: 'asc' }],
  });
  const total = items.reduce((sum, i) => sum + Number(i.amount), 0);
  const grouped = groupByCategory(items);
  return { items, grouped, total };
}

function groupByCategory(items: Array<{ category: string | null; amount: Prisma.Decimal }>) {
  const map = new Map<string, number>();
  for (const item of items) {
    const cat = item.category ?? 'OTHER';
    map.set(cat, (map.get(cat) ?? 0) + Number(item.amount));
  }
  return Array.from(map.entries()).map(([category, amount]) => ({ category, amount }));
}

/* ------------------------------------------------------------------ */
/* CRUD                                                                */
/* ------------------------------------------------------------------ */

export async function createBoqItem(
  companyId: string,
  userId: string,
  projectId: string,
  input: CreateBoqItemInput,
  ipAddress?: string,
) {
  await getProject(companyId, projectId);

  const amount = input.rate * input.quantity;
  const item = await prisma.bOQItem.create({
    data: {
      projectId,
      wbsId: input.wbsId ?? null,
      itemCode: input.itemCode,
      description: input.description,
      unit: input.unit,
      quantity: input.quantity,
      rate: input.rate,
      amount,
      category: input.category ?? 'OTHER',
      isSuperseded: false,
    },
  });

  await recordAudit({
    companyId,
    userId,
    action: 'CREATE',
    entityType: 'boq_item',
    entityId: item.id,
    newValue: { code: item.itemCode, amount },
    ipAddress,
  });

  return item;
}

export async function updateBoqItem(
  companyId: string,
  userId: string,
  itemId: string,
  input: UpdateBoqItemInput,
  ipAddress?: string,
) {
  const existing = await prisma.bOQItem.findFirst({
    where: { id: itemId, project: { companyId } },
  });
  if (!existing) throw ApiError.notFound('BOQ item not found');

  const quantity = input.quantity ?? Number(existing.quantity);
  const rate = input.rate ?? Number(existing.rate);
  const amount = quantity * rate;

  const updated = await prisma.bOQItem.update({
    where: { id: itemId },
    data: {
      ...(input.itemCode !== undefined && { itemCode: input.itemCode }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.unit !== undefined && { unit: input.unit }),
      ...(input.quantity !== undefined && { quantity }),
      ...(input.rate !== undefined && { rate }),
      amount,
      ...(input.category !== undefined && { category: input.category }),
      ...(input.wbsId !== undefined && { wbsId: input.wbsId }),
    },
  });

  await recordAudit({
    companyId,
    userId,
    action: 'UPDATE',
    entityType: 'boq_item',
    entityId: itemId,
    oldValue: { amount: Number(existing.amount) },
    newValue: { amount },
    ipAddress,
  });

  return updated;
}

export async function deleteBoqItem(
  companyId: string,
  userId: string,
  itemId: string,
  ipAddress?: string,
) {
  const item = await prisma.bOQItem.findFirst({
    where: { id: itemId, project: { companyId } },
    select: { id: true },
  });
  if (!item) throw ApiError.notFound('BOQ item not found');

  await prisma.bOQItem.delete({ where: { id: itemId } });

  await recordAudit({
    companyId,
    userId,
    action: 'DELETE',
    entityType: 'boq_item',
    entityId: itemId,
    ipAddress,
  });
}

/* ------------------------------------------------------------------ */
/* CSV Import                                                          */
/* ------------------------------------------------------------------ */

export async function importBoq(
  companyId: string,
  userId: string,
  projectId: string,
  rows: CreateBoqItemInput[],
  ipAddress?: string,
) {
  await getProject(companyId, projectId);

  const data = rows.map((r) => ({
    projectId,
    wbsId: r.wbsId ?? null,
    itemCode: r.itemCode,
    description: r.description,
    unit: r.unit,
    quantity: r.quantity,
    rate: r.rate,
    amount: r.rate * r.quantity,
    category: r.category ?? 'OTHER',
    isSuperseded: false,
  }));

  const result = await prisma.bOQItem.createMany({ data });

  await recordAudit({
    companyId,
    userId,
    action: 'CREATE',
    entityType: 'boq_batch',
    entityId: projectId,
    newValue: { count: result.count },
    ipAddress,
  });

  return { imported: result.count };
}

/* ------------------------------------------------------------------ */
/* From-Estimate Conversion                                            */
/* ------------------------------------------------------------------ */

/**
 * Convert an APPROVED estimate into the project's BOQ.
 *  - Archives existing BOQ items (status = SUPERSEDED, not deleted)
 *  - One BOQItem per EstimateItem
 *  - Sets project.budget = estimate.grandTotal
 *  - Returns summary { created, archived }
 */
export async function convertEstimateToBoq(
  companyId: string,
  userId: string,
  estimateId: string,
  ipAddress?: string,
) {
  const estimate = await prisma.estimate.findFirst({
    where: { id: estimateId, companyId },
    include: { items: true },
  });
  if (!estimate) throw ApiError.notFound('Estimate not found');
  if (estimate.status !== EstimateStatus.APPROVED) {
    throw ApiError.conflict('Only APPROVED estimates can be converted to BOQ');
  }

  const projectId = estimate.projectId;

  // Archive existing BOQ
  const archived = await prisma.bOQItem.updateMany({
    where: { projectId, isSuperseded: false },
    data: { isSuperseded: true },
  });

  // Create new BOQ items from estimate items
  const boqData = estimate.items.map((item) => ({
    projectId,
    wbsId: item.wbsItemId,
    itemCode: item.itemCode ?? `EST-${item.id.slice(-6)}`,
    description: item.description,
    unit: item.unit,
    quantity: Number(item.quantity),
    rate: Number(item.rate),
    amount: Number(item.quantity) * Number(item.rate),
    category: item.type,
    estimateItemId: item.id,
    isSuperseded: false,
  }));

  const created = await prisma.bOQItem.createMany({ data: boqData });

  // Set project budget = estimate grand total
  await prisma.project.update({
    where: { id: projectId },
    data: { budget: estimate.grandTotal },
  });

  await recordAudit({
    companyId,
    userId,
    action: 'CREATE',
    entityType: 'boq_from_estimate',
    entityId: estimateId,
    newValue: { projectId, created: created.count, archived: archived.count },
    ipAddress,
  });

  return {
    projectId,
    estimateId,
    created: created.count,
    archived: archived.count,
    budget: Number(estimate.grandTotal),
  };
}