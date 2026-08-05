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
        estimateItem: { select: { resourceId: true, rateAnalysisId: true } },
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
      // VAR-C6: Prefer estimateItem's RA, fall back to BOQItem's direct RA
      // (set on variation-created rows with no estimateItem link).
      resourceId: estimateItem?.resourceId ?? item.resourceId ?? null,
      rateAnalysisId: estimateItem?.rateAnalysisId ?? item.rateAnalysisId ?? null,
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

  // SUB-BOQ1B: Aggregate subcontract material issues — linked by boqItemId, unlinked by resourceId
  const boqItemIdList = enrichedItems.map((i) => i.id);
  const subIssuedByBoqItem = new Map<string, number>();
  const subIssuedUnlinkedByResource = new Map<string, number>();
  if (boqItemIdList.length > 0 || resourceIds.length > 0) {
    const subIssues = await prisma.subcontractorMaterialIssue.findMany({
      where: {
        workOrder: { projectId, project: { companyId } },
        OR: [
          ...(boqItemIdList.length > 0 ? [{ boqItemId: { in: boqItemIdList } }] : []),
          ...(resourceIds.length > 0
            ? [{ boqItemId: null, resourceId: { in: resourceIds } }]
            : []),
        ],
      },
      select: { boqItemId: true, resourceId: true, quantity: true, recoveredQty: true },
    });
    for (const si of subIssues) {
      const net = Number(si.quantity) - Number(si.recoveredQty);
      if (si.boqItemId) {
        subIssuedByBoqItem.set(
          si.boqItemId,
          (subIssuedByBoqItem.get(si.boqItemId) ?? 0) + net,
        );
      } else {
        subIssuedUnlinkedByResource.set(
          si.resourceId,
          (subIssuedUnlinkedByResource.get(si.resourceId) ?? 0) + net,
        );
      }
    }
  }

  const itemsWithStock = enrichedItems.map((item) => {
    const linked = subIssuedByBoqItem.get(item.id) ?? 0;
    const unlinked = item.resourceId ? (subIssuedUnlinkedByResource.get(item.resourceId) ?? 0) : 0;
    const subIssuedQty = linked + unlinked;
    return {
      ...item,
      stockQty: item.resourceId ? (stockByResource.get(item.resourceId) ?? 0) : undefined,
      subIssuedQty: item.resourceId || linked > 0 ? subIssuedQty : undefined,
    };
  });

  // R14-VO1: Resolve variation provenance — which approved change orders touched
  // each BOQ line? A line is touched if a ChangeOrderLine references it by
  // boqItemId, or if the BOQ line was created as new scope (itemCode = VO-{number}).
  const boqItemIds = itemsWithStock.map((i) => i.id);
  const [coLinesByBoq, variationCreatedItems] = await Promise.all([
    prisma.changeOrderLine.findMany({
      where: {
        boqItemId: { in: boqItemIds },
        changeOrder: { projectId, companyId, status: 'APPROVED' },
      },
      select: { boqItemId: true, changeOrder: { select: { number: true } } },
    }),
    // New-scope BOQ rows created by variations have itemCode = VO-{co.number}
    prisma.changeOrder.findMany({
      where: { projectId, companyId, status: 'APPROVED' },
      select: { number: true },
    }),
  ]);

  const variationByBoqId = new Map<string, Set<string>>();
  for (const col of coLinesByBoq) {
    if (!col.boqItemId) continue;
    if (!variationByBoqId.has(col.boqItemId)) {
      variationByBoqId.set(col.boqItemId, new Set());
    }
    variationByBoqId.get(col.boqItemId)!.add(col.changeOrder.number);
  }

  const itemsWithVariation = itemsWithStock.map((item) => {
    const variationNumbers = new Set<string>();
    // From ChangeOrderLine links
    for (const num of variationByBoqId.get(item.id) ?? []) {
      variationNumbers.add(num);
    }
    // From new-scope rows (itemCode = VO-{number})
    for (const co of variationCreatedItems) {
      if (item.itemCode === `VO-${co.number}`) {
        variationNumbers.add(co.number);
      }
    }
    return {
      ...item,
      variationNumbers: variationNumbers.size > 0 ? Array.from(variationNumbers) : undefined,
    };
  });

  const total = itemsWithVariation.reduce((sum, i) => sum + Number(i.amount), 0);
  const grouped = groupByCategory(itemsWithVariation);
  const sectionGrouped = groupBySection(itemsWithVariation);
  return { items: itemsWithVariation, grouped, sectionGrouped, total };
}

/** Group BOQ items by their `section` field (from estimate section name). */
function groupBySection(items: Array<{ section: string | null; amount: Prisma.Decimal }>) {
  const map = new Map<string, { items: typeof items; amount: number }>();
  for (const item of items) {
    const sec = item.section ?? 'Ungrouped';
    const itemAmount = Number(item.amount);
    const existing = map.get(sec);
    if (existing) {
      existing.items.push(item);
      existing.amount += itemAmount;
    } else {
      map.set(sec, { items: [item], amount: itemAmount });
    }
  }
  return Array.from(map.entries()).map(([section, { items: sectionItems, amount }]) => ({
    section,
    items: sectionItems,
    amount,
  }));
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
      section: input.section ?? null,
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
      ...(input.section !== undefined && { section: input.section }),
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
    section: r.section ?? null,
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
    include: {
      items: {
        include: { section: { select: { name: true } } },
      },
    },
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

  // Sub-estimates (parentId != null) represent additional scope. Their items
  // should be APPENDED to the existing BOQ, not replace it. Only top-level
  // estimates archive and rebuild the BOQ from scratch.
  const isSubEstimate = !!estimate.parentId;

  // FIX (EST-C3): Wrap archive + null-links + createMany + budget update in a
  // single $transaction so a mid-way failure (e.g. createMany throws) doesn't
  // leave the BOQ archived with nothing created. Indent generation runs AFTER
  // the transaction as a non-fatal side-effect (Global Rule 2).
  const topLevelEstimateItems = estimate.items.filter((i) => !i.parentId);
  const itemCodePrefix = isSubEstimate ? `SUB-${estimate.name.slice(0, 10).toUpperCase().replace(/\s+/g, '-')}` : '';

  const { archivedCount, createdCount, newBoqItemLinks } = await prisma.$transaction(async (tx) => {
    // FIX (EST-C2): Archive existing BOQ lines BEFORE nulling estimateItemId.
    // Capture the previous total of this sub-estimate's BOQ lines FIRST so the
    // budget delta compares like-with-like (sum of BOQ item amounts, not
    // estimate.grandTotal which includes overhead/profit/GST).
    let previousSubEstimateBudget = 0;
    if (isSubEstimate) {
      const existingSubItems = await tx.bOQItem.findMany({
        where: {
          projectId,
          isSuperseded: false,
          estimateItemId: { in: topLevelEstimateItems.map((i) => i.id) },
        },
        select: { amount: true },
      });
      previousSubEstimateBudget = existingSubItems.reduce(
        (s, i) => s + Number(i.amount),
        0,
      );
    }

    // Archive
    const archived = isSubEstimate
      ? await tx.bOQItem.updateMany({
          where: {
            projectId,
            isSuperseded: false,
            estimateItemId: { in: topLevelEstimateItems.map((i) => i.id) },
          },
          data: { isSuperseded: true },
        })
      : await tx.bOQItem.updateMany({
          where: { projectId, isSuperseded: false },
          data: { isSuperseded: true },
        });

    // Null estimateItemId links (after archiving, so the filter still matches)
    if (isSubEstimate) {
      await tx.bOQItem.updateMany({
        where: {
          projectId,
          estimateItemId: { in: topLevelEstimateItems.map((i) => i.id) },
        },
        data: { estimateItemId: null },
      });
    } else {
      await tx.bOQItem.updateMany({
        where: { projectId },
        data: { estimateItemId: null },
      });
    }

    // Create new BOQ items from top-level estimate items only (EST-C1)
    const boqData = topLevelEstimateItems.map((item) => ({
      projectId,
      wbsId: item.wbsItemId,
      itemCode: item.itemCode ?? (isSubEstimate ? `${itemCodePrefix}-${item.id.slice(-6)}` : `EST-${item.id.slice(-6)}`),
      description: item.description,
      unit: item.unit,
      quantity: Number(item.quantity),
      rate: Number(item.rate),
      amount: Number(item.quantity) * Number(item.rate),
      category: isSubEstimate ? `${item.type}/${estimate.name}` : item.type,
      section: item.section?.name ?? null,
      estimateItemId: item.id,
      isSuperseded: false,
    }));
    const created = await tx.bOQItem.createMany({ data: boqData });

    // Budget update — consistent basis (sum of new BOQ amounts vs old).
    const newBoqTotal = boqData.reduce((s, b) => s + b.amount, 0);
    if (isSubEstimate) {
      // FIX (EST-C2): delta on a consistent basis (BOQ item sums), not
      // grandTotal vs item-sums which double-counts overhead/profit/GST on
      // every re-conversion.
      const delta = newBoqTotal - previousSubEstimateBudget;
      await tx.project.update({
        where: { id: projectId },
        data: { budget: { increment: delta } },
      });
    } else {
      await tx.project.update({
        where: { id: projectId },
        data: { budget: estimate.grandTotal },
      });
    }

    // Fetch the newly created links (inside the tx so they're visible)
    const newBoqItems = await tx.bOQItem.findMany({
      where: { projectId, isSuperseded: false, estimateItemId: { not: null } },
      select: { id: true, estimateItemId: true },
    });
    const links = new Map<string, string>();
    for (const b of newBoqItems) {
      if (b.estimateItemId) links.set(b.estimateItemId, b.id);
    }

    return { archivedCount: archived.count, createdCount: created.count, newBoqItemLinks: links };
  });

  const archived = { count: archivedCount };
  const created = { count: createdCount };
  const boqByEstimateItemId = newBoqItemLinks;

  // FIX (EST-C1): Use topLevelEstimateItems (parentId null) only — not ALL
  // estimate.items. Sub-items are exploded from their parents' rate analyses,
  // so passing them too double-counts material demand.
  const materialDemands = await buildMaterialDemandsFromEstimateItems(
    companyId,
    topLevelEstimateItems.map((i) => ({
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