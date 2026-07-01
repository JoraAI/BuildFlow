/**
 * BuildFlow - BOQ service.
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
import { createDraftIndentsFromDemand, buildMaterialDemandsFromEstimateItems } from './material-demand.service';

/* ------------------------------------------------------------------ */
/* List & Get                                                          */
/* ------------------------------------------------------------------ */

export async function listBoq(companyId: string, projectId: string) {
  await getProject(companyId, projectId);
  const [items, invoiceLines] = await Promise.all([
    prisma.bOQItem.findMany({
      where: { projectId, isSuperseded: false },
      include: {
        estimateItem: { select: { resourceId: true } },
      },
      orderBy: [{ category: 'asc' }, { itemCode: 'asc' }],
    }),
    prisma.invoiceLineItem.findMany({
      where: {
        boqItemId: { not: null },
        invoice: { projectId, companyId, invoiceType: 'RUNNING_ACCOUNT', status: { not: 'DRAFT' } },
      },
      select: { boqItemId: true, cumulativeQty: true },
    }),
  ]);

  const billedByBoq = new Map<string, number>();
  for (const line of invoiceLines) {
    if (!line.boqItemId) continue;
    const qty = Number(line.cumulativeQty);
    billedByBoq.set(line.boqItemId, Math.max(billedByBoq.get(line.boqItemId) ?? 0, qty));
  }

  const enrichedItems = items.map((item) => {
    const { estimateItem, ...rest } = item;
    const sanctionedQty = Number(item.quantity);
    const executedQty = Number(item.executedQty);
    const procuredQty = Number(item.procuredQty ?? 0);
    const billedCumulativeQty = billedByBoq.get(item.id) ?? 0;
    const balanceQty = Math.max(0, sanctionedQty - executedQty);
    const progressPct =
      sanctionedQty > 0 ? Math.min(100, Math.round((executedQty / sanctionedQty) * 100)) : 0;
    const billableQty = Math.max(0, executedQty - billedCumulativeQty);
    return {
      ...rest,
      resourceId: estimateItem?.resourceId ?? null,
      sanctionedQty,
      executedQty,
      procuredQty,
      billedCumulativeQty,
      balanceQty,
      progressPct,
      billableQty,
    };
  });

  const resourceIds = enrichedItems
    .map((i) => i.resourceId)
    .filter((id): id is string => Boolean(id));

  const stockByResource = new Map<string, number>();
  if (resourceIds.length > 0) {
    const balances = await prisma.stockBalance.findMany({
      where: {
        resourceId: { in: resourceIds },
        location: { projectId, companyId },
      },
    });
    for (const balance of balances) {
      stockByResource.set(
        balance.resourceId,
        (stockByResource.get(balance.resourceId) ?? 0) + Number(balance.quantity),
      );
    }
  }

  const itemsWithStock = enrichedItems.map((item) => ({
    ...item,
    stockQty: item.resourceId ? (stockByResource.get(item.resourceId) ?? 0) : undefined,
  }));

  const total = itemsWithStock.reduce((sum, i) => sum + Number(i.amount), 0);
  const grouped = groupByCategory(itemsWithStock);
  return { items: itemsWithStock, grouped, total };
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

  const project = await prisma.project.findFirst({
    where: { id: estimate.projectId, companyId, isDeleted: false },
    select: { isTemporary: true },
  });
  if (!project) throw ApiError.notFound('Project not found');
  if (project.isTemporary) {
    throw ApiError.conflict(
      'Cannot convert to BOQ while project is a proposal workspace. Promote the proposal to a project first.',
    );
  }

  const projectId = estimate.projectId;

  // Archive existing BOQ and release estimate-item links (unique constraint)
  await prisma.bOQItem.updateMany({
    where: { projectId },
    data: { estimateItemId: null },
  });
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

  const newBoqItems = await prisma.bOQItem.findMany({
    where: { projectId, isSuperseded: false, estimateItemId: { not: null } },
    select: { id: true, estimateItemId: true },
  });
  const boqByEstimateItemId = new Map<string, string>();
  for (const b of newBoqItems) {
    if (b.estimateItemId) boqByEstimateItemId.set(b.estimateItemId, b.id);
  }

  const materialDemands = await buildMaterialDemandsFromEstimateItems(
    estimate.items.map((i) => ({
      id: i.id,
      type: i.type,
      resourceId: i.resourceId,
      rateAnalysisId: i.rateAnalysisId,
      quantity: i.quantity,
      unit: i.unit,
    })),
    boqByEstimateItemId,
  );
  const indentResult = await createDraftIndentsFromDemand(
    companyId,
    userId,
    projectId,
    materialDemands,
    'ESTIMATE_CONVERT',
    estimate.name,
  );

  await recordAudit({
    companyId,
    userId,
    action: 'CREATE',
    entityType: 'boq_from_estimate',
    entityId: estimateId,
    newValue: { projectId, created: created.count },
    ipAddress,
  });

  return {
    projectId,
    estimateId,
    created: created.count,
    archived: archived.count,
    budget: Number(estimate.grandTotal),
    draftIndentsCreated: indentResult.created,
    draftIndentNumbers: indentResult.reqNumbers,
  };
}

export async function recordBoqMeasurement(
  companyId: string,
  userId: string,
  boqItemId: string,
  input: { quantity: number; notes?: string; measuredAt?: string },
  ipAddress?: string,
) {
  const item = await prisma.bOQItem.findFirst({
    where: { id: boqItemId, project: { companyId }, isSuperseded: false },
  });
  if (!item) throw ApiError.notFound('BOQ item not found');

  const result = await prisma.$transaction(async (tx) => {
    const measurement = await tx.boqMeasurement.create({
      data: {
        boqItemId,
        projectId: item.projectId,
        quantity: input.quantity,
        measuredAt: input.measuredAt ? new Date(input.measuredAt) : new Date(),
        recordedBy: userId,
        notes: input.notes ?? null,
      },
    });

    const updated = await tx.bOQItem.update({
      where: { id: boqItemId },
      data: { executedQty: { increment: input.quantity } },
    });

    return { measurement, executedQty: Number(updated.executedQty) };
  });

  await recordAudit({
    companyId,
    userId,
    action: 'CREATE',
    entityType: 'boq_measurement',
    entityId: result.measurement.id,
    newValue: { boqItemId, quantity: input.quantity, executedQty: result.executedQty },
    ipAddress,
  });

  return result;
}

export async function getBoqVsActualLines(companyId: string, projectId: string) {
  await getProject(companyId, projectId);
  const boq = await listBoq(companyId, projectId);

  const bills = await prisma.bill.findMany({
    where: { projectId, companyId, status: { in: ['APPROVED', 'PAID'] } },
    select: { subtotal: true, category: true },
  });

  const spendByCategory = new Map<string, number>();
  for (const b of bills) {
    const cat = b.category ?? 'OTHER';
    spendByCategory.set(cat, (spendByCategory.get(cat) ?? 0) + Number(b.subtotal));
  }

  const boqByCategory = new Map<string, number>();
  for (const item of boq.items) {
    const cat = item.category ?? 'OTHER';
    boqByCategory.set(cat, (boqByCategory.get(cat) ?? 0) + Number(item.amount));
  }

  return {
    lines: boq.items.map((item) => {
      const boqAmount = Number(item.amount);
      const cat = item.category ?? 'OTHER';
      const catBoq = boqByCategory.get(cat) ?? 0;
      const catSpend = spendByCategory.get(cat) ?? 0;
      const actualSpend = catBoq > 0 ? (boqAmount / catBoq) * catSpend : 0;
      return {
        id: item.id,
        itemCode: item.itemCode,
        description: item.description,
        unit: item.unit,
        category: item.category,
        sanctionedQty: item.sanctionedQty,
        executedQty: item.executedQty,
        billedCumulativeQty: item.billedCumulativeQty,
        billableQty: item.billableQty,
        progressPct: item.progressPct,
        boqAmount,
        actualSpend: Math.round(actualSpend * 100) / 100,
        variance: Math.round((actualSpend - boqAmount) * 100) / 100,
      };
    }),
    categoryTotals: Array.from(spendByCategory.entries()).map(([category, actualSpend]) => ({
      category,
      actualSpend,
    })),
  };
}