import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { assertProjectAccess } from '../middleware/project-access.middleware';
import type {
  CreateSubcontractorInput,
  CreateWorkOrderInput,
  CreateMeasurementInput,
} from '@buildflow/shared';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// ------------------------------------------------------------------
// Subcontractors (company-scoped)
// ------------------------------------------------------------------

export async function listSubcontractors(companyId: string) {
  return prisma.subcontractor.findMany({
    where: { companyId },
    include: { _count: { select: { workOrders: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function getSubcontractor(companyId: string, id: string) {
  const sub = await prisma.subcontractor.findFirst({
    where: { id, companyId },
    include: { workOrders: { select: { id: true, woNumber: true, projectId: true, status: true } } },
  });
  if (!sub) throw ApiError.notFound('Subcontractor not found');
  return sub;
}

export async function createSubcontractor(companyId: string, input: CreateSubcontractorInput) {
  return prisma.subcontractor.create({
    data: { companyId, ...input },
  });
}

export async function updateSubcontractor(
  companyId: string,
  id: string,
  input: Partial<CreateSubcontractorInput>,
) {
  const sub = await prisma.subcontractor.findFirst({ where: { id, companyId } });
  if (!sub) throw ApiError.notFound('Subcontractor not found');
  return prisma.subcontractor.update({
    where: { id },
    data: input,
  });
}

export async function deleteSubcontractor(companyId: string, id: string) {
  const sub = await prisma.subcontractor.findFirst({
    where: { id, companyId },
    include: { _count: { select: { workOrders: true } } },
  });
  if (!sub) throw ApiError.notFound('Subcontractor not found');
  if (sub._count.workOrders > 0) {
    throw ApiError.conflict('Cannot delete subcontractor with existing work orders');
  }
  return prisma.subcontractor.delete({ where: { id } });
}

// ------------------------------------------------------------------
// Work orders (project-scoped)
// ------------------------------------------------------------------

export async function listWorkOrders(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId);
  return prisma.subcontractWorkOrder.findMany({
    where: { projectId },
    include: {
      subcontractor: { select: { id: true, name: true, gstin: true } },
      _count: { select: { measurements: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getWorkOrder(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  workOrderId: string,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId);
  const wo = await prisma.subcontractWorkOrder.findFirst({
    where: { id: workOrderId, projectId },
    include: {
      subcontractor: true,
      measurements: { include: { lines: true }, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!wo) throw ApiError.notFound('Work order not found');
  const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
  if (!project) throw ApiError.notFound('Project not found');
  return wo;
}

export async function createWorkOrder(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  input: CreateWorkOrderInput,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId, ['OWNER', 'PM']);

  const sub = await prisma.subcontractor.findFirst({
    where: { id: input.subcontractorId, companyId },
  });
  if (!sub) throw ApiError.notFound('Subcontractor not found');

  return prisma.subcontractWorkOrder.create({
    data: {
      projectId,
      subcontractorId: input.subcontractorId,
      woNumber: input.woNumber,
      scope: input.scope,
      contractValue: input.contractValue,
      retentionPct: input.retentionPct,
      advanceAmount: input.advanceAmount,
      startDate: input.startDate,
      endDate: input.endDate,
    },
    include: { subcontractor: { select: { id: true, name: true } } },
  });
}

export async function updateWorkOrder(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  workOrderId: string,
  input: Partial<CreateWorkOrderInput & { status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' }>,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId, ['OWNER', 'PM']);
  const wo = await prisma.subcontractWorkOrder.findFirst({
    where: { id: workOrderId, projectId },
  });
  if (!wo) throw ApiError.notFound('Work order not found');

  if (input.subcontractorId) {
    const sub = await prisma.subcontractor.findFirst({
      where: { id: input.subcontractorId, companyId },
    });
    if (!sub) throw ApiError.notFound('Subcontractor not found');
  }

  return prisma.subcontractWorkOrder.update({
    where: { id: workOrderId },
    data: input,
    include: { subcontractor: { select: { id: true, name: true } } },
  });
}

export async function deleteWorkOrder(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  workOrderId: string,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId, ['OWNER', 'PM']);
  const wo = await prisma.subcontractWorkOrder.findFirst({
    where: { id: workOrderId, projectId },
    include: { _count: { select: { measurements: true, bills: true } } },
  });
  if (!wo) throw ApiError.notFound('Work order not found');
  if (wo._count.measurements > 0 || wo._count.bills > 0) {
    throw ApiError.conflict('Cannot delete work order with measurements or bills');
  }
  return prisma.subcontractWorkOrder.delete({ where: { id: workOrderId } });
}

// ------------------------------------------------------------------
// Measurements
// ------------------------------------------------------------------

export async function listMeasurements(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  workOrderId: string,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId);
  const wo = await prisma.subcontractWorkOrder.findFirst({
    where: { id: workOrderId, projectId },
  });
  if (!wo) throw ApiError.notFound('Work order not found');

  return prisma.subcontractMeasurement.findMany({
    where: { workOrderId },
    include: { lines: true, bills: { select: { id: true, billNumber: true, status: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getMeasurement(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  measurementId: string,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId);
  const m = await prisma.subcontractMeasurement.findFirst({
    where: { id: measurementId },
    include: {
      lines: true,
      workOrder: { include: { subcontractor: true, project: { select: { id: true, companyId: true } } } },
      bills: true,
    },
  });
  if (!m || m.workOrder.projectId !== projectId || m.workOrder.project.companyId !== companyId) {
    throw ApiError.notFound('Measurement not found');
  }
  return m;
}

export async function createMeasurement(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  workOrderId: string,
  input: CreateMeasurementInput,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId, ['OWNER', 'PM', 'SUPERVISOR']);

  const wo = await prisma.subcontractWorkOrder.findFirst({
    where: { id: workOrderId, projectId },
  });
  if (!wo) throw ApiError.notFound('Work order not found');

  const lines = input.lines.map((l) => ({
    ...l,
    amount: round2(l.quantity * l.rate),
  }));
  const totalAmount = round2(lines.reduce((s, l) => s + l.amount, 0));

  return prisma.subcontractMeasurement.create({
    data: {
      workOrderId,
      periodLabel: input.periodLabel,
      totalAmount,
      lines: { create: lines },
    },
    include: { lines: true },
  });
}

export async function updateMeasurement(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  measurementId: string,
  input: CreateMeasurementInput,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId, ['OWNER', 'PM', 'SUPERVISOR']);

  const existing = await getMeasurement(companyId, userId, role, projectId, measurementId);
  if (existing.status !== 'DRAFT' && existing.status !== 'REJECTED') {
    throw ApiError.badRequest('Only draft or rejected measurements can be edited');
  }

  const lines = input.lines.map((l) => ({
    ...l,
    amount: round2(l.quantity * l.rate),
  }));
  const totalAmount = round2(lines.reduce((s, l) => s + l.amount, 0));

  return prisma.$transaction(async (tx) => {
    await tx.subcontractMeasurementLine.deleteMany({ where: { measurementId } });
    return tx.subcontractMeasurement.update({
      where: { id: measurementId },
      data: {
        periodLabel: input.periodLabel,
        totalAmount,
        lines: { create: lines },
      },
      include: { lines: true },
    });
  });
}

export async function deleteMeasurement(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  measurementId: string,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId, ['OWNER', 'PM']);

  const m = await getMeasurement(companyId, userId, role, projectId, measurementId);
  if (m.status !== 'DRAFT') throw ApiError.badRequest('Only draft measurements can be deleted');
  if (m.bills.length > 0) throw ApiError.conflict('Cannot delete measurement linked to bills');

  return prisma.subcontractMeasurement.delete({ where: { id: measurementId } });
}

export async function approveMeasurement(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  measurementId: string,
  options?: { createBill?: boolean },
) {
  if (role !== 'OWNER' && role !== 'PM') {
    throw ApiError.forbidden('Only owner or PM can approve measurements');
  }

  const m = await getMeasurement(companyId, userId, role, projectId, measurementId);
  if (m.status !== 'SUBMITTED' && m.status !== 'DRAFT') {
    throw ApiError.badRequest('Measurement must be draft or submitted to approve');
  }

  return prisma.$transaction(async (tx) => {
    const approved = await tx.subcontractMeasurement.update({
      where: { id: measurementId },
      data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() },
      include: { lines: true, workOrder: { include: { subcontractor: true } } },
    });

    let bill = null;
    if (options?.createBill) {
      const wo = approved.workOrder;
      const billNumber = `SC-${wo.woNumber}-${approved.id.slice(0, 8)}`.slice(0, 50);
      bill = await tx.bill.create({
        data: {
          projectId,
          companyId,
          billNumber,
          vendorName: wo.subcontractor.name,
          vendorGstin: wo.subcontractor.gstin,
          billDate: new Date(),
          status: 'PENDING',
          subtotal: approved.totalAmount,
          total: approved.totalAmount,
          category: 'SUBCONTRACTOR',
          workOrderId: wo.id,
          measurementId: approved.id,
        },
      });
    }

    return { measurement: approved, bill };
  });
}

export async function submitMeasurement(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  measurementId: string,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId, ['OWNER', 'PM', 'SUPERVISOR']);

  const m = await getMeasurement(companyId, userId, role, projectId, measurementId);
  if (m.status !== 'DRAFT' && m.status !== 'REJECTED') {
    throw ApiError.badRequest('Only draft or rejected measurements can be submitted');
  }

  return prisma.subcontractMeasurement.update({
    where: { id: measurementId },
    data: { status: 'SUBMITTED' },
    include: { lines: true },
  });
}
