import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { recordAudit } from '../utils/audit';
import { notify } from './notification.service';
import { nextSequentialNumber } from '../lib/id-generator';
import {
  assertStatusTransition,
  RFI_STATUS_TRANSITIONS,
  SUBMITTAL_STATUS_TRANSITIONS,
} from '../lib/status-transition';
import type { CreateRfiInput, UpdateRfiInput, CreateSubmittalInput, UpdateSubmittalInput, RfiQueryInput, SubmittalQueryInput } from '@buildflow/shared';

// ---- RFI ----
export async function listRfis(companyId: string, query: RfiQueryInput) {
  const { page, limit, projectId, status, priority } = query;
  const where: Record<string, unknown> = { companyId };
  if (projectId) where.projectId = projectId;
  if (status) where.status = status;
  if (priority) where.priority = priority;
  const [rows, total] = await Promise.all([
    prisma.rFI.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page-1)*limit, take: limit,
      include: { project: { select: { id: true, name: true } }, raisedByUser: { select: { id: true, name: true } }, answeredByUser: { select: { id: true, name: true } } } }),
    prisma.rFI.count({ where }),
  ]);
  return { rows, total, page, limit };
}
export async function getRfi(companyId: string, id: string) {
  const r = await prisma.rFI.findFirst({ where: { id, companyId }, include: { project: { select: { id: true, name: true } }, raisedByUser: { select: { id: true, name: true } }, answeredByUser: { select: { id: true, name: true } }, task: { select: { id: true, name: true } } } });
  if (!r) throw ApiError.notFound('RFI not found');
  return r;
}
export async function createRfi(companyId: string, userId: string, input: CreateRfiInput, ip?: string) {
  const project = await prisma.project.findFirst({ where: { id: input.projectId, companyId, isDeleted: false }, select: { id: true } });
  if (!project) throw ApiError.notFound('Project not found');
  // FIX (NR-32): Use the dedicated 'rfi' counter type instead of reusing the
  // 'invoice' counter with a string replace.
  const rfiNumber = await nextSequentialNumber(companyId, 'rfi');
  const rfi = await prisma.rFI.create({ data: { companyId, projectId: input.projectId, taskId: input.taskId ?? null, boqItemId: input.boqItemId ?? null, rfiNumber, subject: input.subject, question: input.question, priority: input.priority, attachments: input.attachments, raisedBy: userId, dueDate: input.dueDate ? new Date(input.dueDate) : null },
    include: { project: { select: { id: true, name: true } } } });
  await recordAudit({ companyId, userId, action: 'CREATE', entityType: 'rfi', entityId: rfi.id, newValue: { rfiNumber: rfi.rfiNumber, subject: rfi.subject }, ipAddress: ip });
  return rfi;
}
export async function updateRfi(companyId: string, userId: string, id: string, input: UpdateRfiInput, ip?: string) {
  const existing = await getRfi(companyId, id);
  if (input.status !== undefined && input.status !== existing.status) {
    if (input.status === 'ANSWERED') {
      throw ApiError.badRequest('Use the answer endpoint to mark an RFI as answered');
    }
    assertStatusTransition(existing.status, input.status, RFI_STATUS_TRANSITIONS, 'RFI');
  }
  const updated = await prisma.rFI.update({ where: { id }, data: {
    ...(input.subject !== undefined && { subject: input.subject }), ...(input.question !== undefined && { question: input.question }),
    ...(input.priority !== undefined && { priority: input.priority }), ...(input.status !== undefined && { status: input.status }),
    ...(input.attachments !== undefined && { attachments: input.attachments }), ...(input.dueDate !== undefined && { dueDate: input.dueDate ? new Date(input.dueDate) : null }),
  }, include: { project: { select: { id: true, name: true } } } });
  await recordAudit({ companyId, userId, action: 'UPDATE', entityType: 'rfi', entityId: id, ipAddress: ip });
  return updated;
}
export async function answerRfi(companyId: string, userId: string, id: string, answer: string, ip?: string) {
  const guard = await prisma.rFI.updateMany({
    where: { id, companyId, status: 'OPEN' },
    data: { answer, answeredBy: userId, answeredAt: new Date(), status: 'ANSWERED' },
  });
  if (guard.count === 0) throw ApiError.conflict('RFI is not open or was already answered');
  const updated = await prisma.rFI.findFirst({
    where: { id, companyId },
    include: { project: { select: { id: true, name: true } }, raisedByUser: { select: { id: true } } },
  });
  if (!updated) throw ApiError.notFound('RFI not found');
  await recordAudit({ companyId, userId, action: 'ANSWER', entityType: 'rfi', entityId: id, ipAddress: ip });
  if (updated.raisedByUser) {
    await notify({ userId: updated.raisedByUser.id, companyId, title: 'RFI answered', body: `RFI ${updated.rfiNumber} has been answered.`, type: 'RFI_ANSWERED', referenceId: id });
  }
  return updated;
}

// ---- Submittal ----
export async function listSubmittals(companyId: string, query: SubmittalQueryInput) {
  const { page, limit, projectId, status, type } = query;
  const where: Record<string, unknown> = { companyId };
  if (projectId) where.projectId = projectId;
  if (status) where.status = status;
  if (type) where.type = type;
  const [rows, total] = await Promise.all([
    prisma.submittal.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page-1)*limit, take: limit,
      include: { project: { select: { id: true, name: true } }, submittedByUser: { select: { id: true, name: true } }, reviewedByUser: { select: { id: true, name: true } } } }),
    prisma.submittal.count({ where }),
  ]);
  return { rows, total, page, limit };
}
export async function getSubmittal(companyId: string, id: string) {
  const s = await prisma.submittal.findFirst({ where: { id, companyId }, include: { project: { select: { id: true, name: true } }, submittedByUser: { select: { id: true, name: true } }, reviewedByUser: { select: { id: true, name: true } }, task: { select: { id: true, name: true } } } });
  if (!s) throw ApiError.notFound('Submittal not found');
  return s;
}
export async function createSubmittal(companyId: string, userId: string, input: CreateSubmittalInput, ip?: string) {
  const project = await prisma.project.findFirst({ where: { id: input.projectId, companyId, isDeleted: false }, select: { id: true } });
  if (!project) throw ApiError.notFound('Project not found');
  // FIX (NR-32): Use the dedicated 'submittal' counter type.
  const submittalNo = await nextSequentialNumber(companyId, 'submittal');
  const s = await prisma.submittal.create({ data: { companyId, projectId: input.projectId, taskId: input.taskId ?? null, submittalNo, title: input.title, description: input.description ?? null, type: input.type, attachments: input.attachments, submittedBy: userId, dueDate: input.dueDate ? new Date(input.dueDate) : null },
    include: { project: { select: { id: true, name: true } } } });
  await recordAudit({ companyId, userId, action: 'CREATE', entityType: 'submittal', entityId: s.id, newValue: { submittalNo: s.submittalNo, title: s.title }, ipAddress: ip });
  return s;
}
export async function updateSubmittal(companyId: string, userId: string, id: string, input: UpdateSubmittalInput, ip?: string) {
  const existing = await getSubmittal(companyId, id);
  if (input.status !== undefined && input.status !== existing.status) {
    if (['APPROVED', 'REJECTED', 'REVISE'].includes(input.status)) {
      throw ApiError.badRequest('Use the review endpoint to approve, reject, or request revision');
    }
    assertStatusTransition(existing.status, input.status, SUBMITTAL_STATUS_TRANSITIONS, 'Submittal');
  }
  const updated = await prisma.submittal.update({ where: { id }, data: {
    ...(input.title !== undefined && { title: input.title }), ...(input.description !== undefined && { description: input.description }),
    ...(input.type !== undefined && { type: input.type }), ...(input.status !== undefined && { status: input.status }),
    ...(input.attachments !== undefined && { attachments: input.attachments }), ...(input.reviewNotes !== undefined && { reviewNotes: input.reviewNotes }),
    ...(input.dueDate !== undefined && { dueDate: input.dueDate ? new Date(input.dueDate) : null }),
  }, include: { project: { select: { id: true, name: true } } } });
  await recordAudit({ companyId, userId, action: 'UPDATE', entityType: 'submittal', entityId: id, ipAddress: ip });
  return updated;
}
export async function reviewSubmittal(companyId: string, userId: string, id: string, status: string, reviewNotes: string | undefined, ip?: string) {
  const guard = await prisma.submittal.updateMany({
    where: { id, companyId, status: 'SUBMITTED' },
    data: { status, reviewNotes, reviewedBy: userId, reviewedAt: new Date() },
  });
  if (guard.count === 0) throw ApiError.conflict('Submittal must be submitted before review');
  const updated = await prisma.submittal.findFirst({
    where: { id, companyId },
    include: { project: { select: { id: true, name: true } }, submittedByUser: { select: { id: true } } },
  });
  if (!updated) throw ApiError.notFound('Submittal not found');
  await recordAudit({ companyId, userId, action: 'REVIEW', entityType: 'submittal', entityId: id, newValue: { status, reviewNotes }, ipAddress: ip });
  if (updated.submittedByUser) {
    await notify({ userId: updated.submittedByUser.id, companyId, title: 'Submittal reviewed', body: `Submittal ${updated.submittalNo} has been ${status.toLowerCase()}.`, type: 'SUBMITTAL_REVIEWED', referenceId: id });
  }
  return updated;
}
