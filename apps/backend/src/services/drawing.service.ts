import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { recordAudit } from '../utils/audit';
import type { CreateDrawingInput, UpdateDrawingInput, AddVersionInput, DrawingQueryInput } from '@buildflow/shared';

export async function listDrawings(companyId: string, query: DrawingQueryInput) {
  const { page, limit, projectId, status, discipline } = query;
  const where: Record<string, unknown> = { companyId };
  if (projectId) where.projectId = projectId;
  if (status) where.status = status;
  if (discipline) where.discipline = discipline;
  const [rows, total] = await Promise.all([
    prisma.drawing.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page-1)*limit, take: limit,
      include: { currentVersion: true, project: { select: { id: true, name: true } }, _count: { select: { versions: true } } } }),
    prisma.drawing.count({ where }),
  ]);
  return { rows, total, page, limit };
}
export async function getDrawing(companyId: string, id: string) {
  const d = await prisma.drawing.findFirst({ where: { id, companyId },
    include: { currentVersion: true, versions: { orderBy: { uploadedAt: 'desc' }, include: { uploadedByUser: { select: { id: true, name: true } } } }, project: { select: { id: true, name: true } } } });
  if (!d) throw ApiError.notFound('Drawing not found');
  return d;
}
export async function createDrawing(companyId: string, userId: string, input: CreateDrawingInput, ip?: string) {
  const project = await prisma.project.findFirst({ where: { id: input.projectId, companyId, isDeleted: false }, select: { id: true } });
  if (!project) throw ApiError.notFound('Project not found');
  const d = await prisma.drawing.create({ data: { companyId, projectId: input.projectId, drawingNo: input.drawingNo, title: input.title, discipline: input.discipline, category: input.category ?? null, createdBy: userId },
    include: { project: { select: { id: true, name: true } } } });
  await recordAudit({ companyId, userId, action: 'CREATE', entityType: 'drawing', entityId: d.id, newValue: { drawingNo: d.drawingNo, title: d.title }, ipAddress: ip });
  return d;
}
export async function updateDrawing(companyId: string, userId: string, id: string, input: UpdateDrawingInput, ip?: string) {
  await getDrawing(companyId, id);
  const updated = await prisma.drawing.update({ where: { id }, data: {
    ...(input.title !== undefined && { title: input.title }), ...(input.discipline !== undefined && { discipline: input.discipline }),
    ...(input.category !== undefined && { category: input.category }), ...(input.status !== undefined && { status: input.status }),
  }, include: { project: { select: { id: true, name: true } } } });
  await recordAudit({ companyId, userId, action: 'UPDATE', entityType: 'drawing', entityId: id, ipAddress: ip });
  return updated;
}
export async function addVersion(companyId: string, userId: string, id: string, input: AddVersionInput, ip?: string) {
  await getDrawing(companyId, id);
  const version = await prisma.$transaction(async (tx) => {
    const v = await tx.drawingVersion.create({ data: { drawingId: id, versionLabel: input.versionLabel, fileUrl: input.fileUrl, thumbnailUrl: input.thumbnailUrl ?? null, notes: input.notes ?? null, uploadedBy: userId } });
    await tx.drawing.update({ where: { id }, data: { currentVersionId: v.id } });
    return v;
  });
  await recordAudit({ companyId, userId, action: 'UPLOAD', entityType: 'drawing_version', entityId: version.id, newValue: { versionLabel: version.versionLabel }, ipAddress: ip });
  return version;
}
