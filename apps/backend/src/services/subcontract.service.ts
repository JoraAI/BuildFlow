import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { assertProjectAccess } from '../middleware/project-access.middleware';
import { recordBoqMeasurement } from './boq.service';
import { recordBillPayment } from './bill.service';
import type {
  CreateSubcontractorInput,
  CreateWorkOrderInput,
  CreateWorkOrderFromBoqInput,
  CreateMeasurementInput,
} from '@buildflow/shared';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function num(v: unknown): number {
  return v ? Number(v) : 0;
}

export interface WorkOrderSummary {
  contractValue: number;
  retentionPct: number;
  advanceAmount: number;
  advanceRecovered: number;
  certifiedTotal: number;
  submittedPending: number;
  billedTotal: number;
  paidTotal: number;
  retentionHeld: number;
  retentionReleased: number;
  balanceRemaining: number;
  variationTotal: number;
  certifiedPct: number;
  lines: Array<{
    id: string;
    description: string;
    unit: string;
    contractQty: number;
    rate: number;
    amount: number;
    certifiedQty: number;
    balanceQty: number;
    boqItemId: string | null;
  }>;
  variations: Array<{ number: string; title: string; costImpact: number }>;
}

export async function getWorkOrderSummary(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  workOrderId: string,
): Promise<WorkOrderSummary> {
  await assertProjectAccess(companyId, userId, role as never, projectId);

  const wo = await prisma.subcontractWorkOrder.findFirst({
    where: { id: workOrderId, projectId, project: { companyId } },
    include: {
      contractLines: true,
      measurements: { include: { lines: true } },
      bills: true,
      linkedChangeOrders: {
        where: { status: 'APPROVED' },
        select: { number: true, title: true, costImpact: true },
      },
    },
  });
  if (!wo) throw ApiError.notFound('Work order not found');

  const certifiedTotal = wo.measurements
    .filter((m) => m.status === 'APPROVED')
    .reduce((s, m) => s + num(m.totalAmount), 0);

  const submittedPending = wo.measurements
    .filter((m) => m.status === 'SUBMITTED')
    .reduce((s, m) => s + num(m.totalAmount), 0);

  const billedTotal = wo.bills.reduce((s, b) => s + num(b.subtotal), 0);
  const paidTotal = wo.bills.reduce((s, b) => s + num(b.paidAmount), 0);
  const raBills = wo.bills.filter((b) => !b.isRetentionRelease && b.status !== 'REJECTED');
  const releaseBills = wo.bills.filter((b) => b.isRetentionRelease && b.status !== 'REJECTED');
  const retentionHeld = raBills.reduce((s, b) => s + num(b.retentionAmount), 0);
  const retentionReleased = releaseBills.reduce((s, b) => s + num(b.subtotal), 0);
  const advanceRecovered = wo.bills.reduce((s, b) => s + num(b.advanceRecoveryAmount), 0);

  const contractValue = num(wo.contractValue);
  const balanceRemaining = round2(contractValue - certifiedTotal);

  const certifiedByLine = new Map<string, number>();
  for (const m of wo.measurements.filter((x) => x.status === 'APPROVED')) {
    for (const line of m.lines) {
      if (line.workOrderLineId) {
        certifiedByLine.set(
          line.workOrderLineId,
          (certifiedByLine.get(line.workOrderLineId) ?? 0) + num(line.quantity),
        );
      }
    }
  }

  const lines = wo.contractLines.map((cl) => {
    const certifiedQty = certifiedByLine.get(cl.id) ?? 0;
    return {
      id: cl.id,
      description: cl.description,
      unit: cl.unit,
      contractQty: num(cl.contractQty),
      rate: num(cl.rate),
      amount: num(cl.amount),
      certifiedQty: round2(certifiedQty),
      balanceQty: round2(Math.max(0, num(cl.contractQty) - certifiedQty)),
      boqItemId: cl.boqItemId,
    };
  });

  const variationTotal = wo.linkedChangeOrders.reduce((s, v) => s + num(v.costImpact), 0);

  return {
    contractValue,
    retentionPct: num(wo.retentionPct),
    advanceAmount: num(wo.advanceAmount),
    advanceRecovered,
    certifiedTotal: round2(certifiedTotal),
    submittedPending: round2(submittedPending),
    billedTotal: round2(billedTotal),
    paidTotal: round2(paidTotal),
    retentionHeld: round2(retentionHeld),
    retentionReleased: round2(retentionReleased),
    balanceRemaining,
    variationTotal: round2(variationTotal),
    certifiedPct: contractValue > 0 ? round2((certifiedTotal / contractValue) * 100) : 0,
    lines,
    variations: wo.linkedChangeOrders.map((v) => ({
      number: v.number,
      title: v.title,
      costImpact: num(v.costImpact),
    })),
  };
}

function computeBillBreakdown(
  gross: number,
  retentionPct: number,
  advanceAmount: number,
  advanceRecoveredSoFar: number,
  tdsRate: number,
) {
  const retention = round2(gross * (retentionPct / 100));
  const unrecoveredAdvance = round2(Math.max(0, advanceAmount - advanceRecoveredSoFar));
  const advanceRecovery = round2(Math.min(unrecoveredAdvance, gross * 0.1));
  const beforeTds = round2(gross - retention - advanceRecovery);
  const tdsAmount = round2(beforeTds * (tdsRate / 100));
  const netPayable = round2(beforeTds - tdsAmount);
  return { gross, retention, advanceRecovery, tdsAmount, netPayable, tdsRate };
}

async function postApprovedMeasurementToBoq(
  companyId: string,
  userId: string,
  measurementId: string,
  ipAddress?: string,
) {
  const lines = await prisma.subcontractMeasurementLine.findMany({
    where: { measurementId, boqMeasurementPosted: false, boqItemId: { not: null } },
  });
  for (const line of lines) {
    if (!line.boqItemId) continue;
    await recordBoqMeasurement(
      companyId,
      userId,
      line.boqItemId,
      {
        quantity: num(line.quantity),
        notes: `From subcontract measurement ${measurementId.slice(0, 8)}`,
      },
      ipAddress,
    );
    await prisma.subcontractMeasurementLine.update({
      where: { id: line.id },
      data: { boqMeasurementPosted: true },
    });
  }
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

const woInclude = {
  subcontractor: { select: { id: true, name: true, gstin: true, defaultTdsRate: true } },
  contractLines: true,
  boqItem: { select: { id: true, itemCode: true, description: true } },
  task: { select: { id: true, name: true } },
  _count: { select: { measurements: true } },
} as const;

export async function listWorkOrders(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId);
  return prisma.subcontractWorkOrder.findMany({
    where: { projectId },
    include: woInclude,
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
      ...woInclude,
      measurements: { include: { lines: true }, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!wo) throw ApiError.notFound('Work order not found');
  const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
  if (!project) throw ApiError.notFound('Project not found');
  return wo;
}

function buildContractLines(input: CreateWorkOrderInput) {
  if (input.lines?.length) {
    return input.lines.map((l) => ({
      description: l.description,
      unit: l.unit,
      contractQty: l.contractQty,
      rate: l.rate,
      amount: round2(l.contractQty * l.rate),
      boqItemId: l.boqItemId ?? null,
    }));
  }
  return [];
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

  const contractLines = buildContractLines(input);
  const contractValue =
    input.contractValue > 0
      ? input.contractValue
      : round2(contractLines.reduce((s, l) => s + l.amount, 0));

  return prisma.subcontractWorkOrder.create({
    data: {
      projectId,
      subcontractorId: input.subcontractorId,
      woNumber: input.woNumber,
      scope: input.scope,
      contractValue,
      retentionPct: input.retentionPct,
      advanceAmount: input.advanceAmount,
      startDate: input.startDate,
      endDate: input.endDate,
      boqItemId: input.boqItemId ?? null,
      taskId: input.taskId ?? null,
      status: 'ACTIVE',
      contractLines: contractLines.length ? { create: contractLines } : undefined,
    },
    include: woInclude,
  });
}

export async function createWorkOrderFromBoq(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  input: CreateWorkOrderFromBoqInput,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId, ['OWNER', 'PM']);

  const items = await prisma.bOQItem.findMany({
    where: {
      id: { in: input.boqItemIds },
      projectId,
      isSuperseded: false,
    },
  });
  if (items.length !== input.boqItemIds.length) {
    throw ApiError.badRequest('One or more BOQ items not found on this project');
  }

  const invalid = items.filter((i) => i.category !== 'SUBCONTRACTOR');
  if (invalid.length > 0) {
    throw ApiError.badRequest('Only SUBCONTRACTOR BOQ items can be converted to work orders');
  }

  const contractLines = items.map((item) => ({
    description: item.description,
    unit: item.unit,
    contractQty: num(item.quantity),
    rate: num(item.rate),
    amount: num(item.amount),
    boqItemId: item.id,
  }));

  const contractValue = round2(contractLines.reduce((s, l) => s + l.amount, 0));
  const scope =
    items.length === 1
      ? items[0]!.description
      : items.map((i) => i.itemCode).join(', ') + ' - subcontract package';

  return prisma.subcontractWorkOrder.create({
    data: {
      projectId,
      subcontractorId: input.subcontractorId,
      woNumber: input.woNumber,
      scope,
      contractValue,
      retentionPct: input.retentionPct,
      advanceAmount: input.advanceAmount,
      boqItemId: items.length === 1 ? items[0]!.id : null,
      taskId: input.taskId ?? null,
      status: 'ACTIVE',
      contractLines: { create: contractLines },
    },
    include: woInclude,
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
    include: {
      subcontractor: true,
      measurements: true,
      bills: true,
    },
  });
  if (!wo) throw ApiError.notFound('Work order not found');

  if (input.subcontractorId) {
    const sub = await prisma.subcontractor.findFirst({
      where: { id: input.subcontractorId, companyId },
    });
    if (!sub) throw ApiError.notFound('Subcontractor not found');
  }

  let retentionReleaseBill = null;

  if (input.status === 'COMPLETED') {
    const submitted = wo.measurements.filter((m) => m.status === 'SUBMITTED');
    if (submitted.length > 0) {
      throw ApiError.badRequest('Resolve submitted measurement sheets before completing the work order');
    }
    const drafts = wo.measurements.filter((m) => m.status === 'DRAFT' || m.status === 'REJECTED');
    if (drafts.length > 0) {
      throw ApiError.badRequest('Submit or delete draft/rejected measurements before completing the work order');
    }
    const certifiedTotal = wo.measurements
      .filter((m) => m.status === 'APPROVED')
      .reduce((s, m) => s + num(m.totalAmount), 0);
    const contractValue = num(wo.contractValue);
    if (certifiedTotal + 0.01 < contractValue) {
      throw ApiError.badRequest(
        `Work order is not fully certified (certified ${certifiedTotal}, contract ${contractValue})`,
      );
    }
  }

  if (input.status === 'CANCELLED') {
    const hasApproved = wo.measurements.some((m) => m.status === 'APPROVED');
    const hasBills = wo.bills.some((b) => b.status !== 'REJECTED');
    if (hasApproved || hasBills) {
      throw ApiError.conflict('Cannot cancel work order with approved measurements or bills');
    }
  }

  const { lines, ...rest } = input;

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.subcontractWorkOrder.update({
      where: { id: workOrderId },
      data: {
        ...rest,
        ...(rest.boqItemId !== undefined && { boqItemId: rest.boqItemId ?? null }),
        ...(rest.taskId !== undefined && { taskId: rest.taskId ?? null }),
      },
      include: woInclude,
    });

    if (
      input.status === 'COMPLETED' &&
      !wo.retentionReleasedAt &&
      !wo.bills.some((b) => b.isRetentionRelease)
    ) {
      const completionRaBills = wo.bills.filter((b) => !b.isRetentionRelease && b.status !== 'REJECTED');
      const releaseGross = round2(completionRaBills.reduce((s, b) => s + num(b.retentionAmount), 0));
      if (releaseGross > 0) {
        const tdsRate = num(wo.subcontractor.defaultTdsRate);
        const tdsAmount = round2(releaseGross * (tdsRate / 100));
        const netPayable = round2(releaseGross - tdsAmount);
        const createdReleaseBill = await tx.bill.create({
          data: {
            projectId,
            companyId,
            billNumber: `SC-RET-${wo.woNumber}`.slice(0, 50),
            vendorName: wo.subcontractor.name,
            vendorGstin: wo.subcontractor.gstin,
            billDate: new Date(),
            status: 'PENDING',
            subtotal: releaseGross,
            retentionAmount: 0,
            advanceRecoveryAmount: 0,
            tdsRate,
            tdsAmount,
            total: netPayable,
            category: 'SUBCONTRACTOR',
            workOrderId: wo.id,
            isRetentionRelease: true,
          },
        });
        retentionReleaseBill = {
          id: createdReleaseBill.id,
          billNumber: createdReleaseBill.billNumber,
          total: netPayable,
        };
        await tx.subcontractWorkOrder.update({
          where: { id: workOrderId },
          data: { retentionReleasedAt: new Date() },
        });
      }
    }

    return updated;
  });

  return { workOrder: result, retentionReleaseBill };
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

function mapMeasurementLines(lines: CreateMeasurementInput['lines']) {
  return lines.map((l) => ({
    description: l.description,
    quantity: l.quantity,
    unit: l.unit,
    rate: l.rate,
    amount: round2(l.quantity * l.rate),
    boqItemId: l.boqItemId ?? null,
    workOrderLineId: l.workOrderLineId ?? null,
  }));
}

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
    include: {
      lines: { include: { boqItem: { select: { id: true, itemCode: true } } } },
      bills: { select: { id: true, billNumber: true, status: true, total: true } },
    },
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
  if (wo.status !== 'ACTIVE') {
    throw ApiError.badRequest('Measurements can only be added to active work orders');
  }

  const lines = mapMeasurementLines(input.lines);
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

  const lines = mapMeasurementLines(input.lines);
  const totalAmount = round2(lines.reduce((s, l) => s + l.amount, 0));

  return prisma.$transaction(async (tx) => {
    await tx.subcontractMeasurementLine.deleteMany({ where: { measurementId } });
    return tx.subcontractMeasurement.update({
      where: { id: measurementId },
      data: {
        periodLabel: input.periodLabel,
        totalAmount,
        status: 'DRAFT',
        rejectionReason: null,
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
  ipAddress?: string,
) {
  if (role !== 'OWNER' && role !== 'PM') {
    throw ApiError.forbidden('Only owner or PM can approve measurements');
  }

  const m = await getMeasurement(companyId, userId, role, projectId, measurementId);
  if (m.status !== 'SUBMITTED' && m.status !== 'DRAFT') {
    throw ApiError.badRequest('Measurement must be draft or submitted to approve');
  }
  if (m.workOrder.status !== 'ACTIVE') {
    throw ApiError.badRequest('Cannot approve measurements on a non-active work order');
  }

  const result = await prisma.$transaction(async (tx) => {
    const approved = await tx.subcontractMeasurement.update({
      where: { id: measurementId },
      data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date(), rejectionReason: null },
      include: { lines: true, workOrder: { include: { subcontractor: true, bills: true } } },
    });

    let bill = null;
    if (options?.createBill) {
      const wo = approved.workOrder;
      const gross = num(approved.totalAmount);
      const advanceRecoveredSoFar = wo.bills.reduce((s, b) => s + num(b.advanceRecoveryAmount), 0);
      const breakdown = computeBillBreakdown(
        gross,
        num(wo.retentionPct),
        num(wo.advanceAmount),
        advanceRecoveredSoFar,
        num(wo.subcontractor.defaultTdsRate),
      );

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
          subtotal: breakdown.gross,
          retentionAmount: breakdown.retention,
          advanceRecoveryAmount: breakdown.advanceRecovery,
          tdsRate: breakdown.tdsRate,
          tdsAmount: breakdown.tdsAmount,
          total: breakdown.netPayable,
          category: 'SUBCONTRACTOR',
          workOrderId: wo.id,
          measurementId: approved.id,
          billSnapshot: {
            capturedAt: new Date().toISOString(),
            workOrder: {
              woNumber: wo.woNumber,
              scope: wo.scope,
              contractValue: Number(wo.contractValue),
              retentionPct: Number(wo.retentionPct),
              status: wo.status,
              subcontractor: {
                name: wo.subcontractor.name,
                gstin: wo.subcontractor.gstin,
                defaultTdsRate: Number(wo.subcontractor.defaultTdsRate),
              },
            },
            measurement: {
              periodLabel: approved.periodLabel,
              totalAmount: Number(approved.totalAmount),
              status: approved.status,
            },
            breakdown,
          },
        },
      });
    }

    return { measurement: approved, bill };
  });

  await postApprovedMeasurementToBoq(companyId, userId, measurementId, ipAddress);

  return result;
}

export async function rejectMeasurement(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  measurementId: string,
  reason?: string,
) {
  if (role !== 'OWNER' && role !== 'PM') {
    throw ApiError.forbidden('Only owner or PM can reject measurements');
  }

  const m = await getMeasurement(companyId, userId, role, projectId, measurementId);
  if (m.status !== 'SUBMITTED') {
    throw ApiError.badRequest('Only submitted measurements can be rejected');
  }

  return prisma.subcontractMeasurement.update({
    where: { id: measurementId },
    data: { status: 'REJECTED', rejectionReason: reason ?? null },
    include: { lines: true },
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
    data: { status: 'SUBMITTED', rejectionReason: null },
    include: { lines: true },
  });
}

export async function recordSubcontractBillPayment(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  billId: string,
  amount: number,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId, ['OWNER', 'PM', 'ACCOUNTANT']);

  const bill = await prisma.bill.findFirst({
    where: { id: billId, companyId, projectId, workOrderId: { not: null } },
  });
  if (!bill) throw ApiError.notFound('Subcontractor bill not found');

  return recordBillPayment(companyId, userId, billId, { amount, method: 'BANK' });
}
