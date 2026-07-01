import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { recordAudit } from '../utils/audit';
import type { CreateChangeOrderInput } from '@buildflow/shared';
import { assertProjectAccess } from '../middleware/project-access.middleware';
import { createDraftIndentsFromDemand, type MaterialDemandLine } from './material-demand.service';
import { notify } from './notification.service';

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

  const materialDemands: MaterialDemandLine[] = [];

  await prisma.$transaction(async (tx) => {
    for (const line of co.lines) {
      if (line.boqItemId) {
        const boq = await tx.bOQItem.findFirst({ where: { id: line.boqItemId, projectId: co.projectId } });
        if (boq) {
          const newQty = Number(boq.quantity) + Number(line.qtyDelta);
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

      if (line.resourceId && Number(line.qtyDelta) > 0) {
        materialDemands.push({
          resourceId: line.resourceId,
          quantity: Number(line.qtyDelta),
          unit: line.unit,
          boqItemId: line.boqItemId ?? undefined,
        });
      }
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

    await tx.changeOrder.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date(), rejectionReason: null },
    });
  });

  if (materialDemands.length > 0) {
    await createDraftIndentsFromDemand(
      companyId,
      userId,
      co.projectId,
      materialDemands,
      'VARIATION',
      co.number,
    );
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
