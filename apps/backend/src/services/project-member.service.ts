import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import type { Role } from '@buildflow/shared';

export async function listMembers(companyId: string, projectId: string) {
  const project = await prisma.project.findFirst({ where: { id: projectId, companyId, isDeleted: false } });
  if (!project) throw ApiError.notFound('Project not found');
  return prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
}

export async function setMembers(
  companyId: string,
  projectId: string,
  members: { userId: string; role: Role }[],
) {
  const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
  if (!project) throw ApiError.notFound('Project not found');

  await prisma.projectMember.deleteMany({ where: { projectId } });
  if (members.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { companyId, id: { in: members.map((m) => m.userId) }, isActive: true },
  });
  if (users.length !== members.length) throw ApiError.badRequest('Invalid user ids');

  await prisma.projectMember.createMany({
    data: members.map((m) => ({ projectId, userId: m.userId, role: m.role })),
  });

  return listMembers(companyId, projectId);
}
