import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { recordAudit } from '../utils/audit';
import type { CreateChangeOrderInput } from '@buildflow/shared';
import { assertProjectAccess } from '../middleware/project-access.middleware';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export async function listChangeOrders(companyId: string, userId: string, role: string, projectId: string) {
  await assertProjectAccess(companyId, userId, role as never, projectId);
  return prisma.changeOrder.findMany({
    where: { projectId, companyId },
    include: { lines: true, createdByUser: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
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
    ...l,
    amount: round2(l.qtyDelta * l.rate),
  }));
  const costImpact = round2(lines.reduce((s, l) => s + l.amount, 0));

  return prisma.changeOrder.create({
    data: {
      projectId,
      companyId,
      number: input.number,
      title: input.title,
      reason: input.reason,
      costImpact,
      scheduleImpactDays: input.scheduleImpactDays,
      createdBy: userId,
      lines: { create: lines },
    },
    include: { lines: true },
  });
}

export async function submitChangeOrder(companyId: string, userId: string, role: string, id: string) {
  const co = await prisma.changeOrder.findFirst({ where: { id, companyId } });
  if (!co) throw ApiError.notFound('Change order not found');
  await assertProjectAccess(companyId, userId, role as never, co.projectId, ['OWNER', 'PM']);
  if (co.status !== 'DRAFT' && co.status !== 'REJECTED') {
    throw ApiError.badRequest('Only draft or rejected variations can be submitted');
  }
  return prisma.changeOrder.update({
    where: { id },
    data: { status: 'SUBMITTED' },
    include: { lines: true },
  });
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

  await recordAudit({
    companyId,
    userId,
    action: 'APPROVE',
    entityType: 'ChangeOrder',
    entityId: id,
    ipAddress: ip,
  });

  return prisma.changeOrder.findFirst({ where: { id }, include: { lines: true } });
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
    include: { lines: true },
  });
  await recordAudit({
    companyId,
    userId,
    action: 'REJECT',
    entityType: 'ChangeOrder',
    entityId: id,
    newValue: { reason },
  });
  return updated;
}
