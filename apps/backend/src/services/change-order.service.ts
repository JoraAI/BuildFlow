import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { recordAudit } from '../utils/audit';
import type { CreateChangeOrderInput } from '@buildflow/shared';
import { assertProjectAccess } from '../middleware/project-access.middleware';
import { notify } from './notification.service';
import { logger } from '../config/logger';

// VO-B2: MaterialDemandLine import removed — auto-indent creation on approve
// was replaced by a single shortfall path. After approve, shortfalls are
// computed from live BOQ qty (which now includes the variation delta) via
// fetchBoqMaterialDemands. This avoids the qty mismatch where auto-indent
// used raw qtyDelta but shortfalls RA-explode composite BOQ lines.

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function dec(d: Decimal | number | null | undefined): string {
  if (d == null) return '0';
  return String(Number(d));
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

type ChangeOrderRecord = {
  id: string;
  projectId: string;
  companyId: string;
  number: string;
  title: string;
  reason: string | null;
  status: string;
  costImpact: Decimal;
  scheduleImpactDays: number;
  linkedTaskId: string | null;
  linkedWorkOrderId: string | null;
  estimateId: string | null;
  createdBy: string;
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  lines: Array<{
    id: string;
    changeOrderId: string;
    boqItemId: string | null;
    resourceId: string | null;
    description: string;
    unit: string;
    qtyDelta: Decimal;
    rate: Decimal;
    amount: Decimal;
  }>;
  createdByUser?: { id: string; name: string } | null;
  linkedTask?: { id: string; name: string } | null;
  linkedWorkOrder?: { id: string; woNumber: string } | null;
};

function serializeChangeOrder(co: ChangeOrderRecord) {
  return {
    id: co.id,
    projectId: co.projectId,
    companyId: co.companyId,
    number: co.number,
    title: co.title,
    reason: co.reason,
    status: co.status,
    costImpact: dec(co.costImpact),
    scheduleImpactDays: co.scheduleImpactDays,
    linkedTaskId: co.linkedTaskId,
    linkedWorkOrderId: co.linkedWorkOrderId,
    estimateId: co.estimateId,
    createdBy: co.createdBy,
    approvedBy: co.approvedBy,
    approvedAt: co.approvedAt?.toISOString() ?? null,
    rejectionReason: co.rejectionReason,
    createdAt: co.createdAt.toISOString(),
    updatedAt: co.updatedAt.toISOString(),
    lines: co.lines.map((line) => ({
      id: line.id,
      changeOrderId: line.changeOrderId,
      boqItemId: line.boqItemId,
      resourceId: line.resourceId,
      description: line.description,
      unit: line.unit,
      qtyDelta: dec(line.qtyDelta),
      rate: dec(line.rate),
      amount: dec(line.amount),
    })),
    ...(co.createdByUser ? { createdByUser: co.createdByUser } : {}),
    ...(co.linkedTask ? { linkedTask: co.linkedTask } : {}),
    ...(co.linkedWorkOrder ? { linkedWorkOrder: co.linkedWorkOrder } : {}),
  };
}

const changeOrderInclude = {
  lines: true,
  createdByUser: { select: { id: true, name: true } },
  linkedTask: { select: { id: true, name: true } },
  linkedWorkOrder: { select: { id: true, woNumber: true } },
} as const;

export async function listChangeOrders(companyId: string, userId: string, role: string, projectId: string) {
  await assertProjectAccess(companyId, userId, role as never, projectId);
  const rows = await prisma.changeOrder.findMany({
    where: { projectId, companyId },
    include: changeOrderInclude,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(serializeChangeOrder);
}

export async function createChangeOrder(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  input: CreateChangeOrderInput,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId, ['OWNER', 'PM']);

  const lines = input.lines.map((l) => ({
    boqItemId: l.boqItemId,
    resourceId: l.resourceId,
    description: l.description,
    unit: l.unit,
    qtyDelta: l.qtyDelta,
    rate: l.rate,
    amount: round2(l.qtyDelta * l.rate),
  }));
  const costImpact = round2(lines.reduce((s, l) => s + l.amount, 0));

  const created = await prisma.changeOrder.create({
    data: {
      projectId,
      companyId,
      number: input.number,
      title: input.title,
      reason: input.reason,
      costImpact,
      scheduleImpactDays: input.scheduleImpactDays,
      linkedTaskId: input.linkedTaskId,
      linkedWorkOrderId: input.linkedWorkOrderId,
      createdBy: userId,
      lines: { create: lines },
    },
    include: changeOrderInclude,
  });
  return serializeChangeOrder(created);
}

export async function submitChangeOrder(companyId: string, userId: string, role: string, id: string) {
  const co = await prisma.changeOrder.findFirst({ where: { id, companyId } });
  if (!co) throw ApiError.notFound('Change order not found');
  await assertProjectAccess(companyId, userId, role as never, co.projectId, ['OWNER', 'PM']);
  if (co.status !== 'DRAFT' && co.status !== 'REJECTED') {
    throw ApiError.badRequest('Only draft or rejected variations can be submitted');
  }
  const updated = await prisma.changeOrder.update({
    where: { id },
    data: { status: 'SUBMITTED' },
    include: changeOrderInclude,
  });

  const owners = await prisma.user.findMany({
    where: { companyId: co.companyId, role: 'OWNER', isActive: true },
    select: { id: true },
  });
  await Promise.all(
    owners.map((o) =>
      notify({
        userId: o.id,
        companyId: co.companyId,
        title: 'Variation submitted for approval',
        body: co.number + ' - ' + co.title + ' (cost impact: Rs ' + Number(co.costImpact).toLocaleString('en-IN') + ').',
        type: 'CHANGE_ORDER_SUBMITTED',
        referenceId: id,
      }),
    ),
  );

  return serializeChangeOrder(updated);
}

export async function approveChangeOrder(
  companyId: string,
  userId: string,
  role: string,
  id: string,
  ip?: string,
) {
  if (role !== 'OWNER') throw ApiError.forbidden('Only owner can approve variations');
  const co = await prisma.changeOrder.findFirst({
    where: { id, companyId },
    include: { lines: true },
  });
  if (!co) throw ApiError.notFound('Change order not found');
  if (co.status !== 'SUBMITTED') throw ApiError.badRequest('Variation must be submitted first');

  await prisma.$transaction(async (tx) => {
    // FIX (EST-H5): Guard the approval with a conditional updateMany so that
    // two concurrent approvals can't both pass the read-check and double-apply
    // the BOQ/budget changes. If count === 0, another request already approved.
    const guard = await tx.changeOrder.updateMany({
      where: { id, companyId, status: 'SUBMITTED' },
      data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date(), rejectionReason: null },
    });
    if (guard.count === 0) {
      throw ApiError.conflict('This variation has already been processed or is no longer in SUBMITTED status');
    }

    for (const line of co.lines) {
      if (line.boqItemId) {
        const boq = await tx.bOQItem.findFirst({ where: { id: line.boqItemId, projectId: co.projectId } });
        if (boq) {
          // FIX (EST-M14 / VO-B6): Clamp resulting BOQ quantity to at least
          // executedQty (can't reduce below what's already been measured/used)
          // floored at 0. If the raw new qty would go below executedQty, reject
          // with 422 — the variation must account for already-executed work.
          const rawNewQty = Number(boq.quantity) + Number(line.qtyDelta);
          const executedQty = Number(boq.executedQty);
          if (rawNewQty < executedQty) {
            throw ApiError.badRequest(
              `Variation would reduce BOQ qty to ${rawNewQty} but ${executedQty} has already been executed. Adjust the qty delta to at least ${executedQty}.`,
            );
          }
          const newQty = Math.max(0, rawNewQty);
          const newAmount = round2(newQty * Number(boq.rate));
          await tx.bOQItem.update({
            where: { id: boq.id },
            data: { quantity: newQty, amount: newAmount },
          });
        }
      } else if (Number(line.qtyDelta) > 0) {
        await tx.bOQItem.create({
          data: {
            projectId: co.projectId,
            itemCode: `VO-${co.number}`,
            description: line.description,
            unit: line.unit,
            quantity: line.qtyDelta,
            rate: line.rate,
            amount: line.amount,
            category: 'VARIATION',
          },
        });
      }

      // VO-B2: Auto-indent creation removed — rely on single shortfall path
      // (Shortfalls tab) which RA-explodes composite BOQ lines consistently.
    }

    if (co.linkedTaskId && co.scheduleImpactDays !== 0) {
      const task = await tx.task.findFirst({ where: { id: co.linkedTaskId, projectId: co.projectId } });
      if (task) {
        const baseEnd = task.endDate ?? task.startDate ?? new Date();
        await tx.task.update({
          where: { id: task.id },
          data: {
            endDate: addDays(baseEnd, co.scheduleImpactDays),
            durationDays: task.durationDays + co.scheduleImpactDays,
          },
        });
      }
    }

    if (co.linkedWorkOrderId) {
      await tx.subcontractWorkOrder.update({
        where: { id: co.linkedWorkOrderId },
        data: { contractValue: { increment: co.costImpact } },
      });
    }

    await tx.project.update({
      where: { id: co.projectId },
      data: { budget: { increment: co.costImpact } },
    });

    // Status was already set to APPROVED by the guarded updateMany above.
  });

  // VO-B2: Auto-indent creation removed. After approve, the BOQ qty now
  // includes the variation delta. The Shortfalls tab (fetchBoqMaterialDemands)
  // is the single consistent demand path — it RA-explodes composite BOQ lines
  // and correctly subtracts stock + open indents. Users review shortfalls and
  // generate indents manually from Procurement → Shortfalls.

  // FIX (EST-M14): After schedule impact is applied, recompute CPM (critical
  // path method) for the project so downstream tasks' dates shift correctly.
  // Previously only the linked task's dates changed; successor tasks were not
  // re-scheduled, leading to stale Gantt charts.
  if (co.linkedTaskId && co.scheduleImpactDays !== 0) {
    try {
      const { getGantt } = await import('./task.service');
      await getGantt(companyId, co.projectId);
    } catch (err) {
      // Non-fatal: CPM recompute failure shouldn't block the approval
      logger.warn('CPM recompute after change order failed (non-fatal)', { error: String(err) });
    }
  }

  await recordAudit({
    companyId,
    userId,
    action: 'APPROVE',
    entityType: 'ChangeOrder',
    entityId: id,
    ipAddress: ip,
  });

  const approved = await prisma.changeOrder.findFirst({ where: { id }, include: changeOrderInclude });
  if (!approved) throw ApiError.notFound('Change order not found');

  await notify({
    userId: co.createdBy,
    companyId,
    title: 'Variation approved',
    body: co.number + ' - ' + co.title + ' has been approved. BOQ and budget updated.',
    type: 'CHANGE_ORDER_APPROVED',
    referenceId: id,
  });

  return serializeChangeOrder(approved);
}

/**
 * VO-B4: Revised scope summary — original estimate + approved variations.
 * Does NOT mutate estimate lines; derives a read-only revised total.
 */
export async function getProjectScopeSummary(companyId: string, projectId: string) {
  // Latest APPROVED estimate grandTotal (frozen baseline)
  const latestEstimate = await prisma.estimate.findFirst({
    where: { projectId, companyId, status: 'APPROVED' },
    orderBy: { version: 'desc' },
    select: { grandTotal: true },
  });
  const originalEstimateTotal = latestEstimate ? Number(latestEstimate.grandTotal) : 0;

  // Sum of approved variation costImpact
  const approvedVariations = await prisma.changeOrder.aggregate({
    where: { projectId, companyId, status: 'APPROVED' },
    _sum: { costImpact: true },
  });
  const approvedVariationTotal = approvedVariations._sum.costImpact
    ? Number(approvedVariations._sum.costImpact)
    : 0;

  // Current live BOQ total (non-superseded lines)
  const boqAggregate = await prisma.bOQItem.aggregate({
    where: { projectId, isSuperseded: false },
    _sum: { amount: true },
  });
  const currentBoqTotal = boqAggregate._sum.amount ? Number(boqAggregate._sum.amount) : 0;

  return {
    originalEstimateTotal,
    approvedVariationTotal,
    revisedScopeTotal: originalEstimateTotal + approvedVariationTotal,
    currentBoqTotal,
  };
}

/**
 * VO-B1: Post-approve impact summary — what the approve changed.
 */
export async function getChangeOrderImpact(companyId: string, changeOrderId: string) {
  const co = await prisma.changeOrder.findFirst({
    where: { id: changeOrderId, companyId },
    include: { lines: true },
  });
  if (!co) throw ApiError.notFound('Change order not found');

  // BOQ changes: find lines linked to this CO that have a boqItemId
  const boqChanges: Array<{
    boqItemId: string;
    itemCode: string;
    description: string;
    qtyBefore: number;
    qtyAfter: number;
    variationNumber: string;
  }> = [];

  // New-scope BOQ rows created by this variation
  const newScopeRows = await prisma.bOQItem.findMany({
    where: { projectId: co.projectId, itemCode: `VO-${co.number}` },
    select: { id: true, itemCode: true, description: true, quantity: true },
  });
  for (const row of newScopeRows) {
    boqChanges.push({
      boqItemId: row.id,
      itemCode: row.itemCode,
      description: row.description,
      qtyBefore: 0,
      qtyAfter: Number(row.quantity),
      variationNumber: co.number,
    });
  }

  // Linked BOQ line changes (qty delta applied)
  for (const line of co.lines) {
    if (line.boqItemId) {
      const boq = await prisma.bOQItem.findFirst({
        where: { id: line.boqItemId, projectId: co.projectId },
        select: { id: true, itemCode: true, description: true, quantity: true },
      });
      if (boq) {
        boqChanges.push({
          boqItemId: boq.id,
          itemCode: boq.itemCode,
          description: boq.description,
          qtyBefore: Number(boq.quantity) - Number(line.qtyDelta),
          qtyAfter: Number(boq.quantity),
          variationNumber: co.number,
        });
      }
    }
  }

  // Draft indents from this variation (if any were created before VO-B2)
  const indentsCreated = await prisma.materialRequisition.findMany({
    where: { projectId: co.projectId, sourceType: 'VARIATION', sourceRef: co.number },
    select: { id: true, reqNumber: true, status: true },
  });

  return {
    boqChanges,
    indentsCreated,
    budgetDelta: Number(co.costImpact),
    scheduleImpactDays: co.scheduleImpactDays,
  };
}

/**
 * List BOQ items eligible to be picked for a variation (not superseded, with
 * optional search). Used by the mobile "variation BOQ picker" UI.
 */
export async function listEligibleBoqItems(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  search?: string,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId);
  const where: { projectId: string; isSuperseded: boolean; OR?: Array<Record<string, unknown>> } = {
    projectId,
    isSuperseded: false,
  };
  if (search?.trim()) {
    const s = search.trim();
    where.OR = [
      { description: { contains: s, mode: 'insensitive' } },
      { itemCode: { contains: s, mode: 'insensitive' } },
      { category: { contains: s, mode: 'insensitive' } },
    ];
  }
  return prisma.bOQItem.findMany({
    where,
    select: {
      id: true,
      itemCode: true,
      description: true,
      unit: true,
      quantity: true,
      rate: true,
      amount: true,
      category: true,
      section: true,
      // VAR-B4: Include linkage metadata via estimateItem relation so mobile
      // variation form can scope materials (resourceId/rateAnalysisId live on EstimateItem)
      estimateItem: {
        select: { resourceId: true, rateAnalysisId: true },
      },
    },
    orderBy: [{ section: 'asc' }, { itemCode: 'asc' }],
    take: 200,
  });
}

const addBoqLinesSchema = z.object({
  boqItemIds: z.array(z.string().uuid()).min(1).max(100),
});
type AddBoqLinesInput = z.infer<typeof addBoqLinesSchema>;

/**
 * Bulk-attach BOQ items to an existing (draft) change order as variation lines.
 * Each BOQ item's description/unit/rate is pre-filled; the caller sets the qty
 * delta per line afterwards. Lines are only added if the change order is still
 * in DRAFT or REJECTED status (editable).
 */
export async function addBoqLinesToChangeOrder(
  companyId: string,
  userId: string,
  role: string,
  id: string,
  input: AddBoqLinesInput,
) {
  const co = await prisma.changeOrder.findFirst({
    where: { id, companyId },
    include: { lines: { select: { boqItemId: true } } },
  });
  if (!co) throw ApiError.notFound('Change order not found');
  await assertProjectAccess(companyId, userId, role as never, co.projectId, ['OWNER', 'PM']);
  if (co.status !== 'DRAFT' && co.status !== 'REJECTED') {
    throw ApiError.badRequest('BOQ items can only be added to draft variations');
  }

  // Don't re-add items already linked to this change order.
  const existingBoqIds = new Set(co.lines.filter((l) => l.boqItemId).map((l) => l.boqItemId));
  const newIds = input.boqItemIds.filter((bid: string) => !existingBoqIds.has(bid));
  if (newIds.length === 0) {
    return serializeChangeOrder(
      (await prisma.changeOrder.findUnique({
        where: { id },
        include: changeOrderInclude,
      })) as ChangeOrderRecord,
    );
  }

  const boqItems = await prisma.bOQItem.findMany({
    where: { id: { in: newIds }, projectId: co.projectId, isSuperseded: false },
  });
  if (boqItems.length !== newIds.length) {
    throw ApiError.badRequest('One or more BOQ items not found on this project');
  }

  const lines = boqItems.map((item) => ({
    boqItemId: item.id,
    resourceId: null,
    description: item.description,
    unit: item.unit,
    qtyDelta: 0, // default; user edits after attaching
    rate: Number(item.rate),
    amount: 0,
  }));

  await prisma.changeOrderLine.createMany({ data: lines.map((l) => ({ ...l, changeOrderId: id })) });
  // costImpact unchanged because qtyDelta defaults to 0.

  const updated = await prisma.changeOrder.findUnique({
    where: { id },
    include: changeOrderInclude,
  });
  return serializeChangeOrder(updated as ChangeOrderRecord);
}

export async function rejectChangeOrder(
  companyId: string,
  userId: string,
  role: string,
  id: string,
  reason: string,
) {
  if (role !== 'OWNER') throw ApiError.forbidden('Only owner can reject variations');
  const co = await prisma.changeOrder.findFirst({ where: { id, companyId } });
  if (!co) throw ApiError.notFound('Change order not found');
  if (co.status !== 'SUBMITTED') throw ApiError.badRequest('Variation must be submitted first');
  const updated = await prisma.changeOrder.update({
    where: { id },
    data: { status: 'REJECTED', rejectionReason: reason },
    include: changeOrderInclude,
  });
  await recordAudit({
    companyId,
    userId,
    action: 'REJECT',
    entityType: 'ChangeOrder',
    entityId: id,
    newValue: { reason },
  });

  await notify({
    userId: co.createdBy,
    companyId,
    title: 'Variation rejected',
    body: co.number + ' - ' + co.title + ' was rejected: ' + reason,
    type: 'CHANGE_ORDER_REJECTED',
    referenceId: id,
  });

  return serializeChangeOrder(updated);
}

/**
 * FIX (EST-H6): Update a change-order line's qtyDelta and recompute costImpact.
 * Previously, lines were created with qtyDelta: 0 and there was no endpoint to
 * set a non-zero quantity, so costImpact was always 0 and approvals had no
 * financial effect. This lets the PM set the delta per line; costImpact and
 * the change order's total are recomputed atomically.
 */
export async function updateChangeOrderLine(
  companyId: string,
  userId: string,
  role: string,
  changeOrderId: string,
  lineId: string,
  input: { qtyDelta?: number; rate?: number; description?: string },
) {
  // FIX (R2-1): Previously passed '' as projectId to assertProjectAccess, which
  // always 404'd. Fetch the change order FIRST, then pass its real projectId.
  const co = await prisma.changeOrder.findFirst({
    where: { id: changeOrderId, companyId },
    include: { lines: true },
  });
  if (!co) throw ApiError.notFound('Change order not found');
  await assertProjectAccess(companyId, userId, role as never, co.projectId, ['OWNER', 'PM']);
  if (co.status !== 'DRAFT') {
    throw ApiError.badRequest('Only DRAFT change orders can have their lines edited');
  }

  const line = co.lines.find((l) => l.id === lineId);
  if (!line) throw ApiError.notFound('Change order line not found');

  const qtyDelta = input.qtyDelta ?? Number(line.qtyDelta);
  const rate = input.rate ?? Number(line.rate);
  const amount = round2(qtyDelta * rate);

  await prisma.$transaction(async (tx) => {
    await tx.changeOrderLine.update({
      where: { id: lineId },
      data: {
        ...(input.qtyDelta !== undefined && { qtyDelta }),
        ...(input.rate !== undefined && { rate }),
        ...(input.description !== undefined && { description: input.description }),
        amount,
      },
    });

    // Recompute costImpact from ALL lines
    const allLines = await tx.changeOrderLine.findMany({
      where: { changeOrderId },
      select: { amount: true },
    });
    const newCostImpact = round2(allLines.reduce((s, l) => s + Number(l.amount), 0));
    await tx.changeOrder.update({
      where: { id: changeOrderId },
      data: { costImpact: newCostImpact },
    });
  });

  const updated = await prisma.changeOrder.findFirst({
    where: { id: changeOrderId, companyId },
    include: changeOrderInclude,
  });
  return serializeChangeOrder(updated as ChangeOrderRecord);
}
