/**
 * BuildFlow — Project service (business logic).
 *
 * CRUD + WBS + summary stats. All queries are auto-scoped by company_id via
 * the ALS Prisma middleware; we still pass companyId explicitly for clarity.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { recordAudit } from '../utils/audit';
import { withCache, invalidateCache, cacheKeys } from '../utils/cache';
import { Role, EstimateStatus } from '@buildflow/shared';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  ProjectQueryInput,
  CreateWbsItemInput,
  UpdateWbsItemInput,
} from '@buildflow/shared';

// Project summary is recomputed-heavy; cache for 2 min per spec.
const SUMMARY_TTL = 2 * 60;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function toDateOrNull(d?: string): Date | null {
  return d ? new Date(d) : null;
}

function canDelete(role: Role): boolean {
  return role === Role.OWNER;
}

/* ------------------------------------------------------------------ */
/* Projects CRUD                                                       */
/* ------------------------------------------------------------------ */

export async function listProjects(companyId: string, query: ProjectQueryInput) {
  const { page, limit, status, type, search } = query;
  const where: Prisma.ProjectWhereInput = {
    companyId,
    isDeleted: false,
  };
  if (status) where.status = status;
  if (type) where.type = type;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
      { clientName: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.project.count({ where }),
  ]);

  return { rows, total, page, limit };
}

export async function getProject(companyId: string, id: string) {
  const project = await prisma.project.findFirst({
    where: { id, companyId, isDeleted: false },
  });
  if (!project) throw ApiError.notFound('Project not found');
  return project;
}

export async function createProject(
  companyId: string,
  userId: string,
  input: CreateProjectInput,
  ipAddress?: string,
) {
  // Check unique code within company
  const existing = await prisma.project.findFirst({
    where: { companyId, code: input.code, isDeleted: false },
    select: { id: true },
  });
  if (existing) throw ApiError.conflict('Project code already exists in this company');

  const project = await prisma.project.create({
    data: {
      companyId,
      name: input.name,
      code: input.code,
      type: input.type,
      status: input.status ?? undefined,
      clientName: input.clientName,
      clientContact: input.clientContact ?? null,
      locationLat: input.locationLat ?? null,
      locationLng: input.locationLng ?? null,
      locationAddress: input.locationAddress ?? null,
      startDate: toDateOrNull(input.startDate),
      endDate: toDateOrNull(input.endDate),
      budget: input.budget ?? 0,
      createdBy: userId,
    },
  });

  await recordAudit({
    companyId,
    userId,
    action: 'CREATE',
    entityType: 'project',
    entityId: project.id,
    newValue: { name: project.name, code: project.code },
    ipAddress,
  });

  return project;
}

export async function updateProject(
  companyId: string,
  userId: string,
  id: string,
  input: UpdateProjectInput,
  ipAddress?: string,
) {
  const existing = await getProject(companyId, id);

  const updated = await prisma.project.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.code !== undefined && { code: input.code }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.clientName !== undefined && { clientName: input.clientName }),
      ...(input.clientContact !== undefined && { clientContact: input.clientContact }),
      ...(input.locationLat !== undefined && { locationLat: input.locationLat }),
      ...(input.locationLng !== undefined && { locationLng: input.locationLng }),
      ...(input.locationAddress !== undefined && { locationAddress: input.locationAddress }),
      ...(input.startDate !== undefined && { startDate: toDateOrNull(input.startDate) }),
      ...(input.endDate !== undefined && { endDate: toDateOrNull(input.endDate) }),
      ...(input.budget !== undefined && { budget: input.budget }),
    },
  });

  await invalidateCache(cacheKeys.projectSummary(companyId, id), cacheKeys.dashboard(companyId));

  await recordAudit({
    companyId,
    userId,
    action: 'UPDATE',
    entityType: 'project',
    entityId: id,
    oldValue: { name: existing.name, status: existing.status },
    newValue: { name: updated.name, status: updated.status },
    ipAddress,
  });

  return updated;
}

export async function deleteProject(
  companyId: string,
  userId: string,
  role: Role,
  id: string,
  ipAddress?: string,
) {
  if (!canDelete(role)) throw ApiError.forbidden('Only owners can delete projects');

  await getProject(companyId, id);

  // Soft delete
  await prisma.project.update({
    where: { id },
    data: { isDeleted: true },
  });

  await invalidateCache(cacheKeys.projectSummary(companyId, id), cacheKeys.dashboard(companyId));

  await recordAudit({
    companyId,
    userId,
    action: 'DELETE',
    entityType: 'project',
    entityId: id,
    ipAddress,
  });
}

/* ------------------------------------------------------------------ */
/* Project Summary                                                     */
/* ------------------------------------------------------------------ */

export async function getProjectSummary(companyId: string, id: string) {
  return withCache(cacheKeys.projectSummary(companyId, id), SUMMARY_TTL, () =>
    loadProjectSummary(companyId, id),
  );
}

async function loadProjectSummary(companyId: string, id: string) {
  const project = await getProject(companyId, id);

  const [tasks, approvedEstimate] = await Promise.all([
    prisma.task.findMany({
      where: { projectId: id },
      select: {
        durationDays: true,
        progressPct: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    }),
    prisma.estimate.findFirst({
      where: { projectId: id, companyId, status: EstimateStatus.APPROVED },
      orderBy: { version: 'desc' },
      select: { grandTotal: true },
    }),
  ]);

  const taskCount = tasks.length;
  const plannedProgress =
    taskCount > 0
      ? Math.round(tasks.reduce((s, t) => s + t.durationDays * (100 - t.progressPct), 0) / taskCount)
      : 0;
  const actualProgress =
    taskCount > 0
      ? Math.round(tasks.reduce((s, t) => s + t.progressPct, 0) / taskCount)
      : 0;

  const now = new Date();
  const overdueCount = tasks.filter(
    (t) =>
      t.endDate &&
      t.endDate < now &&
      t.status !== 'COMPLETED' &&
      t.status !== 'ON_HOLD',
  ).length;

  // Schedule variance (days between project end and latest task end)
  let scheduleVarianceDays = 0;
  if (project.endDate) {
    const latestTaskEnd = tasks
      .map((t) => t.endDate)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    if (latestTaskEnd) {
      scheduleVarianceDays = Math.round(
        (project.endDate.getTime() - latestTaskEnd.getTime()) / (1000 * 60 * 60 * 24),
      );
    }
  }

  // Budget utilization from bills + material usage
  const billsTotal = await prisma.bill.aggregate({
    where: { projectId: id, companyId, status: { in: ['APPROVED', 'PAID'] } },
    _sum: { total: true },
  });
  const spend = Number(billsTotal._sum.total ?? 0);
  const budget = Number(project.budget ?? 0);
  const budgetUtilization = budget > 0 ? Math.round((spend / budget) * 100) : 0;

  const approvedTotal = approvedEstimate ? Number(approvedEstimate.grandTotal) : 0;
  const estimateVsActualVariance = approvedTotal > 0 ? spend - approvedTotal : 0;

  return {
    plannedProgressPct: plannedProgress,
    actualProgressPct: actualProgress,
    scheduleVarianceDays,
    budgetUtilizationPct: budgetUtilization,
    tasksOverdueCount: overdueCount,
    approvedEstimateTotal: approvedTotal,
    estimateVsActualVariance,
  };
}

/* ------------------------------------------------------------------ */
/* WBS                                                                 */
/* ------------------------------------------------------------------ */

export async function getWbsTree(companyId: string, projectId: string) {
  await getProject(companyId, projectId);

  const items = await prisma.wBSItem.findMany({
    where: { projectId },
    orderBy: [{ orderIndex: 'asc' }, { code: 'asc' }],
  });

  // Build nested tree
  const map = new Map<string, WbsNode>();
  const roots: WbsNode[] = [];

  interface WbsNode {
    id: string;
    projectId: string;
    parentId: string | null;
    code: string;
    name: string;
    level: number;
    orderIndex: number;
    children: WbsNode[];
  }

  for (const item of items) {
    map.set(item.id, { ...item, children: [] });
  }
  for (const item of items) {
    const node = map.get(item.id)!;
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export async function createWbsItem(
  companyId: string,
  userId: string,
  projectId: string,
  input: CreateWbsItemInput,
  ipAddress?: string,
) {
  await getProject(companyId, projectId);

  let level = 1;
  if (input.parentId) {
    const parent = await prisma.wBSItem.findFirst({
      where: { id: input.parentId, projectId },
      select: { level: true },
    });
    if (!parent) throw ApiError.notFound('Parent WBS item not found');
    level = parent.level + 1;
  }

  const item = await prisma.wBSItem.create({
    data: {
      projectId,
      parentId: input.parentId ?? null,
      code: input.code,
      name: input.name,
      level,
      orderIndex: input.orderIndex ?? 0,
    },
  });

  await recordAudit({
    companyId,
    userId,
    action: 'CREATE',
    entityType: 'wbs_item',
    entityId: item.id,
    newValue: { code: item.code, name: item.name },
    ipAddress,
  });

  return item;
}

export async function updateWbsItem(
  companyId: string,
  userId: string,
  projectId: string,
  itemId: string,
  input: UpdateWbsItemInput,
  ipAddress?: string,
) {
  await getProject(companyId, projectId);

  const item = await prisma.wBSItem.findFirst({
    where: { id: itemId, projectId },
  });
  if (!item) throw ApiError.notFound('WBS item not found');

  const updated = await prisma.wBSItem.update({
    where: { id: itemId },
    data: {
      ...(input.code !== undefined && { code: input.code }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.orderIndex !== undefined && { orderIndex: input.orderIndex }),
    },
  });

  await recordAudit({
    companyId,
    userId,
    action: 'UPDATE',
    entityType: 'wbs_item',
    entityId: itemId,
    ipAddress,
  });

  return updated;
}

export async function deleteWbsItem(
  companyId: string,
  userId: string,
  projectId: string,
  itemId: string,
  ipAddress?: string,
) {
  await getProject(companyId, projectId);

  const item = await prisma.wBSItem.findFirst({
    where: { id: itemId, projectId },
    select: { id: true },
  });
  if (!item) throw ApiError.notFound('WBS item not found');

  await prisma.wBSItem.delete({ where: { id: itemId } });

  await recordAudit({
    companyId,
    userId,
    action: 'DELETE',
    entityType: 'wbs_item',
    entityId: itemId,
    ipAddress,
  });
}