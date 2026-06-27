/**
 * BuildFlow — Task & Scheduling service.
 */
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { recordAudit } from '../utils/audit';
import { getProject } from './project.service';
import { computeCriticalPath, offsetToDate } from './cpm.service';
import type { CreateTaskInput, UpdateTaskInput, AddTaskResourceInput } from '@buildflow/shared';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function toDateOrNull(d?: string): Date | null {
  return d ? new Date(d) : null;
}

/** Compute a task end date from start + duration if not provided. */
function deriveEndDate(startDate: Date | null, durationDays: number, endDate?: string | null): Date | null {
  if (endDate) return new Date(endDate);
  if (!startDate) return null;
  return new Date(startDate.getTime() + durationDays * MS_PER_DAY);
}

/* ------------------------------------------------------------------ */
/* Tasks                                                               */
/* ------------------------------------------------------------------ */

export async function listTasks(companyId: string, projectId: string) {
  await getProject(companyId, projectId);
  const tasks = await prisma.task.findMany({
    where: { projectId },
    include: {
      assignee: { select: { id: true, name: true } },
      resources: { include: { resource: { select: { id: true, name: true, unit: true } } } },
      predecessors: { include: { predecessor: { select: { id: true, name: true } } } },
      successors: { include: { task: { select: { id: true, name: true } } } },
    },
    orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
  });
  return tasks;
}

export async function getTask(companyId: string, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, project: { companyId } },
    include: {
      assignee: { select: { id: true, name: true } },
      resources: { include: { resource: true } },
      predecessors: { include: { predecessor: { select: { id: true, name: true } } } },
    },
  });
  if (!task) throw ApiError.notFound('Task not found');
  return task;
}

export async function createTask(
  companyId: string,
  userId: string,
  projectId: string,
  input: CreateTaskInput,
  ipAddress?: string,
) {
  await getProject(companyId, projectId);

  if (input.wbsId) {
    const wbs = await prisma.wBSItem.findFirst({
      where: { id: input.wbsId, projectId },
      select: { id: true },
    });
    if (!wbs) throw ApiError.notFound('WBS item not found');
  }

  const startDate = toDateOrNull(input.startDate);
  const endDate = deriveEndDate(startDate, input.durationDays, input.endDate);

  const task = await prisma.task.create({
    data: {
      projectId,
      wbsId: input.wbsId ?? null,
      name: input.name,
      description: input.description ?? null,
      startDate,
      endDate,
      durationDays: input.durationDays,
      progressPct: input.progressPct ?? 0,
      status: input.status ?? undefined,
      assignedTo: input.assignedTo ?? null,
      constraintType: input.constraintType ?? undefined,
      isMilestone: input.isMilestone ?? false,
    },
  });

  // Add predecessors
  if (input.predecessors && input.predecessors.length > 0) {
    await prisma.taskPredecessor.createMany({
      data: input.predecessors.map((p) => ({
        taskId: task.id,
        predecessorId: p.predecessorId,
        type: p.type ?? undefined,
        lagDays: p.lagDays ?? 0,
      })),
    });
  }

  await recordAudit({
    companyId,
    userId,
    action: 'CREATE',
    entityType: 'task',
    entityId: task.id,
    newValue: { name: task.name },
    ipAddress,
  });

  return getTask(companyId, task.id);
}

export async function updateTask(
  companyId: string,
  userId: string,
  taskId: string,
  input: UpdateTaskInput,
  ipAddress?: string,
) {
  const existing = await getTask(companyId, taskId);

  const startDate = input.startDate !== undefined ? toDateOrNull(input.startDate) : existing.startDate;
  const durationDays = input.durationDays ?? existing.durationDays;
  const endDate =
    input.endDate !== undefined
      ? toDateOrNull(input.endDate)
      : deriveEndDate(startDate, durationDays, existing.endDate?.toISOString());

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.wbsId !== undefined && { wbsId: input.wbsId }),
      startDate,
      endDate,
      ...(input.durationDays !== undefined && { durationDays }),
      ...(input.progressPct !== undefined && { progressPct: input.progressPct }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.assignedTo !== undefined && { assignedTo: input.assignedTo }),
      ...(input.constraintType !== undefined && { constraintType: input.constraintType }),
      ...(input.isMilestone !== undefined && { isMilestone: input.isMilestone }),
    },
  });

  await recordAudit({
    companyId,
    userId,
    action: 'UPDATE',
    entityType: 'task',
    entityId: taskId,
    oldValue: { name: existing.name, progress: existing.progressPct },
    newValue: { name: updated.name, progress: updated.progressPct },
    ipAddress,
  });

  return getTask(companyId, taskId);
}

export async function updateTaskProgress(
  companyId: string,
  userId: string,
  taskId: string,
  progressPct: number,
  ipAddress?: string,
) {
  const task = await getTask(companyId, taskId);

  const status =
    progressPct >= 100 ? 'COMPLETED' : progressPct > 0 ? 'IN_PROGRESS' : task.status;

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { progressPct, status },
  });

  await recordAudit({
    companyId,
    userId,
    action: 'UPDATE',
    entityType: 'task_progress',
    entityId: taskId,
    oldValue: { progress: task.progressPct },
    newValue: { progress: updated.progressPct },
    ipAddress,
  });

  return updated;
}

export async function deleteTask(companyId: string, userId: string, taskId: string, ipAddress?: string) {
  await getTask(companyId, taskId);
  await prisma.task.delete({ where: { id: taskId } });
  await recordAudit({
    companyId,
    userId,
    action: 'DELETE',
    entityType: 'task',
    entityId: taskId,
    ipAddress,
  });
}

/* ------------------------------------------------------------------ */
/* Task Resources                                                      */
/* ------------------------------------------------------------------ */

export async function addTaskResource(
  companyId: string,
  userId: string,
  taskId: string,
  input: AddTaskResourceInput,
  ipAddress?: string,
) {
  await getTask(companyId, taskId);

  const resource = await prisma.resource.findFirst({
    where: { id: input.resourceId, companyId },
    select: { id: true, rate: true, unit: true },
  });
  if (!resource) throw ApiError.notFound('Resource not found');

  const rate = input.rate ?? Number(resource.rate);
  const totalCost = rate * input.quantity;

  const tr = await prisma.taskResource.upsert({
    where: { taskId_resourceId: { taskId, resourceId: input.resourceId } },
    create: {
      taskId,
      resourceId: input.resourceId,
      quantity: input.quantity,
      unit: input.unit,
      rate,
      totalCost,
    },
    update: { quantity: input.quantity, unit: input.unit, rate, totalCost },
  });

  await recordAudit({
    companyId,
    userId,
    action: 'CREATE',
    entityType: 'task_resource',
    entityId: tr.id,
    newValue: { taskId, resourceId: input.resourceId, quantity: input.quantity },
    ipAddress,
  });

  return tr;
}

export async function removeTaskResource(
  companyId: string,
  userId: string,
  taskId: string,
  resourceId: string,
  ipAddress?: string,
) {
  await getTask(companyId, taskId);
  await prisma.taskResource.delete({
    where: { taskId_resourceId: { taskId, resourceId } },
  });
  await recordAudit({
    companyId,
    userId,
    action: 'DELETE',
    entityType: 'task_resource',
    entityId: `${taskId}:${resourceId}`,
    ipAddress,
  });
}

/* ------------------------------------------------------------------ */
/* Gantt + Critical Path                                               */
/* ------------------------------------------------------------------ */

export async function getGantt(companyId: string, projectId: string) {
  await getProject(companyId, projectId);

  const tasks = await prisma.task.findMany({
    where: { projectId },
    select: { id: true, name: true, startDate: true, endDate: true, durationDays: true, progressPct: true, status: true, wbsId: true, isMilestone: true },
    orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
  });

  const dependencies = await prisma.taskPredecessor.findMany({
    where: { task: { projectId } },
    select: { taskId: true, predecessorId: true, type: true, lagDays: true },
  });

  const cpm = computeCriticalPath(
    tasks.map((t) => ({
      id: t.id,
      durationDays: t.durationDays,
      startDate: t.startDate,
      endDate: t.endDate,
    })),
    dependencies.map((d) => ({
      taskId: d.taskId,
      predecessorId: d.predecessorId,
      type: d.type,
      lagDays: d.lagDays,
    })),
  );

  const projectStart = tasks
    .map((t) => t.startDate)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? new Date();

  return {
    tasks: tasks.map((t) => ({
      ...t,
      earlyStart: offsetToDate(projectStart, cpm.earlyStart.get(t.id) ?? 0),
      earlyFinish: offsetToDate(projectStart, cpm.earlyFinish.get(t.id) ?? 0),
      lateStart: offsetToDate(projectStart, cpm.lateStart.get(t.id) ?? 0),
      lateFinish: offsetToDate(projectStart, cpm.lateFinish.get(t.id) ?? 0),
      float: cpm.float.get(t.id) ?? 0,
      isCritical: cpm.criticalPath.includes(t.id),
    })),
    dependencies,
    criticalPath: cpm.criticalPath,
    projectDurationDays: cpm.projectDurationDays,
    projectStart: projectStart.toISOString(),
  };
}

export async function getCriticalPath(companyId: string, projectId: string) {
  const gantt = await getGantt(companyId, projectId);
  return {
    criticalPath: gantt.criticalPath,
    projectDurationDays: gantt.projectDurationDays,
    tasks: gantt.tasks.filter((t) => t.isCritical),
  };
}