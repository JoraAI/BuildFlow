import crypto from 'node:crypto';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { assertProjectAccess } from '../middleware/project-access.middleware';
import type { CreateSubcontractorPortalInput, CreateMeasurementInput } from '@buildflow/shared';
import * as subcontractService from './subcontract.service';

function hashPortalToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generatePortalToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function createSubcontractorPortalAccess(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  input: CreateSubcontractorPortalInput,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId, ['OWNER', 'PM']);

  const sub = await prisma.subcontractor.findFirst({
    where: { id: input.subcontractorId, companyId },
  });
  if (!sub) throw ApiError.notFound('Subcontractor not found');

  if (input.workOrderId) {
    const wo = await prisma.subcontractWorkOrder.findFirst({
      where: { id: input.workOrderId, projectId, subcontractorId: input.subcontractorId },
    });
    if (!wo) throw ApiError.notFound('Work order not found for this subcontractor');
  }

  const token = generatePortalToken();
  const tokenHash = hashPortalToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);

  const access = await prisma.subcontractorPortalAccess.create({
    data: {
      projectId,
      subcontractorId: input.subcontractorId,
      workOrderId: input.workOrderId ?? null,
      tokenHash,
      label: input.label,
      scopes: input.scopes,
      expiresAt,
      createdBy: userId,
    },
  });

  return { ...access, token };
}

export async function getSubPortalByToken(token: string) {
  const tokenHash = hashPortalToken(token);
  const access = await prisma.subcontractorPortalAccess.findUnique({
    where: { tokenHash },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          code: true,
          companyId: true,
          isDeleted: true,
        },
      },
      subcontractor: { select: { id: true, name: true } },
      workOrder: { select: { id: true, woNumber: true, scope: true, contractValue: true, status: true } },
    },
  });

  if (!access) throw ApiError.notFound('Invalid portal link');
  if (access.expiresAt < new Date()) throw ApiError.unauthorized('Portal link has expired');
  if (access.project.isDeleted) throw ApiError.notFound('Project not found');

  return access;
}

export async function getSubPortalData(token: string) {
  const access = await getSubPortalByToken(token);
  const { project, subcontractor, workOrder, scopes } = access;

  const woWhere = {
    projectId: project.id,
    subcontractorId: subcontractor.id,
    ...(access.workOrderId ? { id: access.workOrderId } : {}),
  };

  const data: Record<string, unknown> = {
    project: { id: project.id, name: project.name, code: project.code },
    subcontractor,
    workOrder,
    scopes,
    label: access.label,
    expiresAt: access.expiresAt,
  };

  if (scopes.includes('VIEW_WO')) {
    const workOrders = await prisma.subcontractWorkOrder.findMany({
      where: woWhere,
      select: {
        id: true,
        woNumber: true,
        scope: true,
        contractValue: true,
        status: true,
        retentionPct: true,
        advanceAmount: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    data.workOrders = workOrders;
  }

  if (scopes.includes('VIEW_PAYMENTS')) {
    const bills = await prisma.bill.findMany({
      where: {
        projectId: project.id,
        companyId: project.companyId,
        workOrder: { subcontractorId: subcontractor.id },
      },
      select: {
        id: true,
        billNumber: true,
        billDate: true,
        status: true,
        subtotal: true,
        total: true,
        paidAmount: true,
        retentionAmount: true,
      },
      orderBy: { billDate: 'desc' },
      take: 20,
    });
    data.payments = bills;
  }

  return data;
}

export async function subPortalCreateMeasurement(
  token: string,
  workOrderId: string,
  input: CreateMeasurementInput,
) {
  const access = await getSubPortalByToken(token);
  if (!access.scopes.includes('SUBMIT_MEASUREMENT')) {
    throw ApiError.forbidden('Portal does not allow measurement submission');
  }

  if (access.workOrderId && access.workOrderId !== workOrderId) {
    throw ApiError.forbidden('Work order not in portal scope');
  }

  const wo = await prisma.subcontractWorkOrder.findFirst({
    where: {
      id: workOrderId,
      projectId: access.projectId,
      subcontractorId: access.subcontractorId,
    },
  });
  if (!wo) throw ApiError.notFound('Work order not found');

  return subcontractService.createMeasurement(
    access.project.companyId,
    access.createdBy,
    'SUPERVISOR',
    access.projectId,
    workOrderId,
    input,
  );
}

export async function subPortalSubmitMeasurement(token: string, measurementId: string) {
  const access = await getSubPortalByToken(token);
  if (!access.scopes.includes('SUBMIT_MEASUREMENT')) {
    throw ApiError.forbidden('Portal does not allow measurement submission');
  }

  const m = await prisma.subcontractMeasurement.findFirst({
    where: { id: measurementId },
    include: { workOrder: true },
  });
  if (!m || m.workOrder.projectId !== access.projectId) {
    throw ApiError.notFound('Measurement not found');
  }
  if (m.workOrder.subcontractorId !== access.subcontractorId) {
    throw ApiError.forbidden('Measurement not in portal scope');
  }
  if (access.workOrderId && access.workOrderId !== m.workOrderId) {
    throw ApiError.forbidden('Measurement not in portal scope');
  }

  return subcontractService.submitMeasurement(
    access.project.companyId,
    access.createdBy,
    'SUPERVISOR',
    access.projectId,
    measurementId,
  );
}
