/**
 * BuildFlow - Portal experience enhancements (Phase 5 §8.6).
 *
 * Adds: portal revocation, portal access listing, and enriched portal data
 * (drawings, RFIs, punch items, task progress) for the client-facing view.
 */
import crypto from 'node:crypto';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { assertProjectAccess } from '../middleware/project-access.middleware';

export async function listPortalAccess(companyId: string, userId: string, role: string, projectId: string) {
  await assertProjectAccess(companyId, userId, role as never, projectId, ['OWNER', 'PM']);
  return prisma.clientPortalAccess.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, label: true, scopes: true, expiresAt: true, createdAt: true, createdBy: true },
  });
}

export async function revokePortalAccess(companyId: string, userId: string, role: string, projectId: string, accessId: string) {
  await assertProjectAccess(companyId, userId, role as never, projectId, ['OWNER', 'PM']);
  const access = await prisma.clientPortalAccess.findFirst({ where: { id: accessId, projectId } });
  if (!access) throw ApiError.notFound('Portal access not found');
  await prisma.clientPortalAccess.delete({ where: { id: accessId } });
  return { success: true };
}

export async function getEnhancedPortalData(token: string) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const access = await prisma.clientPortalAccess.findUnique({
    where: { tokenHash },
    include: { project: { select: { id: true, name: true, code: true, status: true, clientName: true, companyId: true, isDeleted: true, budget: true, startDate: true, endDate: true } } },
  });
  if (!access) throw ApiError.notFound('Invalid portal link');
  if (access.expiresAt < new Date()) throw ApiError.unauthorized('Portal link has expired');
  if (access.project.isDeleted) throw ApiError.notFound('Project not found');

  const { project, scopes } = access;
  const projectId = project.id;
  const companyId = project.companyId;

  // FIX (NR-45): Only expose the project budget if the portal token explicitly
  // carries the 'financials' scope. Previously budget was returned to ALL token
  // holders, leaking the contractor's internal cost basis to any client.
  const includeFinancials = scopes.includes('financials');
  const data: Record<string, unknown> = {
    project: {
      id: project.id,
      name: project.name,
      code: project.code,
      status: project.status,
      clientName: project.clientName,
      ...(includeFinancials ? { budget: Number(project.budget) } : {}),
      startDate: project.startDate,
      endDate: project.endDate,
    },
    access: { label: access.label, scopes, expiresAt: access.expiresAt },
  };

  // Scope-gated enriched data
  if (scopes.includes('invoices') || scopes.includes('financials')) {
    const invoices = await prisma.invoice.findMany({
      where: { projectId, status: { in: ['SENT', 'PAID', 'OVERDUE'] } },
      orderBy: { invoiceDate: 'desc' }, take: 50,
      select: { id: true, invoiceNumber: true, invoiceDate: true, dueDate: true, status: true, total: true, paidAmount: true, invoiceType: true },
    });
    data.invoices = invoices.map((i) => ({ ...i, total: Number(i.total), paidAmount: Number(i.paidAmount) }));
  }

  if (scopes.includes('progress') || scopes.includes('tasks')) {
    const tasks = await prisma.task.findMany({
      where: { projectId },
      select: { id: true, name: true, status: true, progressPct: true, startDate: true, endDate: true },
      orderBy: { startDate: 'asc' }, take: 200,
    });
    data.tasks = tasks;
  }

  if (scopes.includes('drawings')) {
    const drawings = await prisma.drawing.findMany({
      where: { companyId, projectId, status: 'APPROVED' },
      include: { currentVersion: { select: { fileUrl: true, thumbnailUrl: true, versionLabel: true } } },
      orderBy: { drawingNo: 'asc' }, take: 100,
    });
    data.drawings = drawings;
  }

  if (scopes.includes('rfis')) {
    const rfis = await prisma.rFI.findMany({
      where: { companyId, projectId, status: { in: ['ANSWERED', 'CLOSED'] } },
      select: { id: true, rfiNumber: true, subject: true, question: true, answer: true, status: true, priority: true, createdAt: true, answeredAt: true },
      orderBy: { createdAt: 'desc' }, take: 50,
    });
    data.rfis = rfis;
  }

  if (scopes.includes('punch_list')) {
    const punchItems = await prisma.punchItem.findMany({
      where: { companyId, projectId },
      select: { id: true, title: true, status: true, priority: true, location: true, assignedTo: true, dueDate: true, closedAt: true },
      orderBy: { createdAt: 'desc' }, take: 100,
    });
    data.punchItems = punchItems;
  }

  return data;
}
