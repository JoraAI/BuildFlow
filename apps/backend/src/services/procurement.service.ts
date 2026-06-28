import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { assertProjectAccess } from '../middleware/project-access.middleware';
import type {
  CreateRequisitionInput,
  CreatePurchaseOrderInput,
  CreateGrnInput,
} from '@buildflow/shared';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function getOrCreateProjectStockLocation(
  companyId: string,
  projectId: string,
  tx: Pick<typeof prisma, 'stockLocation'>,
) {
  const existing = await tx.stockLocation.findFirst({
    where: { companyId, projectId },
  });
  if (existing) return existing;
  return tx.stockLocation.create({
    data: { companyId, projectId, name: 'Site Store' },
  });
}

export async function listRequisitions(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId);
  return prisma.materialRequisition.findMany({
    where: { projectId, companyId },
    include: {
      lines: { include: { resource: { select: { id: true, name: true } } } },
      purchaseOrders: { select: { id: true, poNumber: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createRequisition(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  input: CreateRequisitionInput,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId, ['OWNER', 'PM', 'SUPERVISOR']);

  return prisma.materialRequisition.create({
    data: {
      projectId,
      companyId,
      reqNumber: input.reqNumber,
      notes: input.notes,
      requestedBy: userId,
      lines: { create: input.lines },
    },
    include: { lines: true },
  });
}

export async function submitRequisition(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  requisitionId: string,
) {
  const req = await prisma.materialRequisition.findFirst({
    where: { id: requisitionId, projectId, companyId },
  });
  if (!req) throw ApiError.notFound('Requisition not found');
  await assertProjectAccess(companyId, userId, role as never, projectId, ['OWNER', 'PM', 'SUPERVISOR']);
  if (req.status !== 'DRAFT' && req.status !== 'REJECTED') {
    throw ApiError.badRequest('Only draft or rejected requisitions can be submitted');
  }
  return prisma.materialRequisition.update({
    where: { id: requisitionId },
    data: { status: 'SUBMITTED' },
    include: { lines: true },
  });
}

export async function approveRequisition(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  requisitionId: string,
) {
  if (role !== 'OWNER' && role !== 'PM') {
    throw ApiError.forbidden('Only owner or PM can approve requisitions');
  }
  const req = await prisma.materialRequisition.findFirst({
    where: { id: requisitionId, projectId, companyId },
  });
  if (!req) throw ApiError.notFound('Requisition not found');
  await assertProjectAccess(companyId, userId, role as never, projectId);
  if (req.status !== 'SUBMITTED') throw ApiError.badRequest('Requisition must be submitted first');

  return prisma.materialRequisition.update({
    where: { id: requisitionId },
    data: { status: 'APPROVED', approvedBy: userId },
    include: { lines: true },
  });
}

export async function createPO(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  input: CreatePurchaseOrderInput,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId, ['OWNER', 'PM', 'ACCOUNTANT']);

  if (input.requisitionId) {
    const req = await prisma.materialRequisition.findFirst({
      where: { id: input.requisitionId, projectId, companyId },
    });
    if (!req) throw ApiError.notFound('Requisition not found');
    if (req.status !== 'APPROVED') throw ApiError.badRequest('Requisition must be approved before creating PO');
  }

  const lines = input.lines.map((l) => ({
    ...l,
    amount: round2(l.quantity * l.rate),
  }));
  const totalAmount = round2(lines.reduce((s, l) => s + l.amount, 0));

  return prisma.purchaseOrder.create({
    data: {
      projectId,
      companyId,
      requisitionId: input.requisitionId,
      poNumber: input.poNumber,
      vendorName: input.vendorName,
      totalAmount,
      lines: { create: lines },
    },
    include: { lines: { include: { resource: { select: { id: true, name: true } } } } },
  });
}

export async function createGRN(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  input: CreateGrnInput,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId, ['OWNER', 'PM', 'SUPERVISOR']);

  const po = await prisma.purchaseOrder.findFirst({
    where: { id: input.purchaseOrderId, projectId, companyId },
    include: { lines: true },
  });
  if (!po) throw ApiError.notFound('Purchase order not found');

  return prisma.$transaction(async (tx) => {
    const grn = await tx.goodsReceiptNote.create({
      data: {
        projectId,
        companyId,
        purchaseOrderId: input.purchaseOrderId,
        grnNumber: input.grnNumber,
        receivedDate: input.receivedDate,
        notes: input.notes,
        lines: { create: input.lines },
      },
      include: { lines: true },
    });

    const location = await getOrCreateProjectStockLocation(companyId, projectId, tx);

    for (const line of input.lines) {
      const balance = await tx.stockBalance.findUnique({
        where: {
          locationId_resourceId: { locationId: location.id, resourceId: line.resourceId },
        },
      });

      if (balance) {
        await tx.stockBalance.update({
          where: { id: balance.id },
          data: { quantity: { increment: line.quantity } },
        });
      } else {
        await tx.stockBalance.create({
          data: {
            locationId: location.id,
            resourceId: line.resourceId,
            quantity: line.quantity,
          },
        });
      }

      await tx.stockMovement.create({
        data: {
          locationId: location.id,
          resourceId: line.resourceId,
          quantity: line.quantity,
          type: 'IN',
          referenceType: 'GRN',
          referenceId: grn.id,
        },
      });
    }

    return grn;
  });
}

export async function listStock(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId);

  const locations = await prisma.stockLocation.findMany({
    where: { companyId, projectId },
    include: {
      balances: {
        include: { resource: { select: { id: true, name: true, unit: true } } },
      },
    },
  });

  return locations;
}
