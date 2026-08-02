import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { recordAudit } from '../utils/audit';
import { assertStatusTransition, PUNCH_STATUS_TRANSITIONS } from '../lib/status-transition';
import type { CreatePunchItemInput, UpdatePunchItemInput, PunchItemQueryInput } from '@buildflow/shared';

export async function listPunchItems(companyId: string, query: PunchItemQueryInput) {
  const { page, limit, projectId, status, priority } = query;
  const where: Record<string, unknown> = { companyId };
  if (projectId) where.projectId = projectId;
  if (status) where.status = status;
  if (priority) where.priority = priority;
  const [rows, total] = await Promise.all([
    prisma.punchItem.findMany({
      where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
      include: { project: { select: { id: true, name: true } }, assignee: { select: { id: true, name: true } }, creator: { select: { id: true, name: true } } },
    }),
    prisma.punchItem.count({ where }),
  ]);
  return { rows, total, page, limit };
}

export async function getPunchItem(companyId: string, id: string) {
  const item = await prisma.punchItem.findFirst({
    where: { id, companyId },
    include: { project: { select: { id: true, name: true } }, assignee: { select: { id: true, name: true } }, creator: { select: { id: true, name: true } }, task: { select: { id: true, name: true } } },
  });
  if (!item) throw ApiError.notFound('Punch item not found');
  return item;
}

export async function createPunchItem(companyId: string, userId: string, input: CreatePunchItemInput, ip?: string) {
  const project = await prisma.project.findFirst({ where: { id: input.projectId, companyId, isDeleted: false }, select: { id: true } });
  if (!project) throw ApiError.notFound('Project not found');
  const item = await prisma.punchItem.create({
    data: { companyId, projectId: input.projectId, taskId: input.taskId ?? null, title: input.title, description: input.description ?? null, location: input.location ?? null, priority: input.priority, assignedTo: input.assignedTo ?? null, dueDate: input.dueDate ? new Date(input.dueDate) : null, photos: input.photos, createdBy: userId },
    include: { project: { select: { id: true, name: true } } },
  });
  await recordAudit({ companyId, userId, action: 'CREATE', entityType: 'punch_item', entityId: item.id, newValue: { title: item.title, priority: item.priority }, ipAddress: ip });
  return item;
}

export async function updatePunchItem(companyId: string, userId: string, id: string, input: UpdatePunchItemInput, ip?: string) {
  const existing = await getPunchItem(companyId, id);
  if (input.status !== undefined && input.status !== existing.status) {
    assertStatusTransition(existing.status, input.status, PUNCH_STATUS_TRANSITIONS, 'Punch item');
  }
  const wasClosed = existing.status === 'CLOSED';
  const isClosing = input.status === 'CLOSED' && !wasClosed;
  const updated = await prisma.punchItem.update({
    where: { id },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.location !== undefined && { location: input.location }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.assignedTo !== undefined && { assignedTo: input.assignedTo }),
      ...(input.dueDate !== undefined && { dueDate: input.dueDate ? new Date(input.dueDate) : null }),
      ...(input.photos !== undefined && { photos: input.photos }),
      ...(isClosing && { closedAt: new Date(), closedBy: userId }),
    },
    include: { project: { select: { id: true, name: true } }, assignee: { select: { id: true, name: true } } },
  });
  await recordAudit({ companyId, userId, action: 'UPDATE', entityType: 'punch_item', entityId: id, oldValue: { status: existing.status, priority: existing.priority }, newValue: { status: updated.status, priority: updated.priority }, ipAddress: ip });
  return updated;
}

export async function deletePunchItem(companyId: string, userId: string, id: string, ip?: string) {
  await getPunchItem(companyId, id);
  await prisma.punchItem.delete({ where: { id } });
  await recordAudit({ companyId, userId, action: 'DELETE', entityType: 'punch_item', entityId: id, ipAddress: ip });
}
