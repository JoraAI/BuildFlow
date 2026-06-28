import crypto from 'node:crypto';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { assertProjectAccess } from '../middleware/project-access.middleware';
import type { CreatePortalAccessInput } from '@buildflow/shared';

function hashPortalToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generatePortalToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function createPortalAccess(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  input: CreatePortalAccessInput,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId, ['OWNER', 'PM']);

  const token = generatePortalToken();
  const tokenHash = hashPortalToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);

  const access = await prisma.clientPortalAccess.create({
    data: {
      projectId,
      tokenHash,
      label: input.label,
      scopes: input.scopes,
      expiresAt,
      createdBy: userId,
    },
  });

  return { ...access, token };
}

export async function getPortalByToken(token: string) {
  const tokenHash = hashPortalToken(token);
  const access = await prisma.clientPortalAccess.findUnique({
    where: { tokenHash },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          clientName: true,
          companyId: true,
          isDeleted: true,
        },
      },
    },
  });

  if (!access) throw ApiError.notFound('Invalid portal link');
  if (access.expiresAt < new Date()) throw ApiError.unauthorized('Portal link has expired');
  if (access.project.isDeleted) throw ApiError.notFound('Project not found');

  return access;
}

export async function getPortalProjectData(token: string) {
  const access = await getPortalByToken(token);
  const { project, scopes } = access;
  const projectId = project.id;

  const data: Record<string, unknown> = {
    project: {
      id: project.id,
      name: project.name,
      code: project.code,
      status: project.status,
      clientName: project.clientName,
    },
    scopes,
    label: access.label,
    expiresAt: access.expiresAt,
  };

  if (scopes.includes('VIEW_PROGRESS')) {
    const [tasks, reports] = await Promise.all([
      prisma.task.findMany({
        where: { projectId },
        select: { id: true, name: true, status: true, progressPct: true, endDate: true },
        orderBy: { startDate: 'asc' },
        take: 50,
      }),
      prisma.dailyReport.findMany({
        where: { projectId },
        select: { id: true, reportDate: true, workDone: true, weather: true },
        orderBy: { reportDate: 'desc' },
        take: 10,
      }),
    ]);
    data.progress = { tasks, recentReports: reports };
  }

  if (scopes.includes('VIEW_INVOICES') || scopes.includes('PAY_INVOICES')) {
    const invoices = await prisma.invoice.findMany({
      where: { projectId, companyId: project.companyId },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        dueDate: true,
        status: true,
        total: true,
        paidAmount: true,
      },
      orderBy: { invoiceDate: 'desc' },
      take: 20,
    });
    data.invoices = invoices;
  }

  return data;
}
