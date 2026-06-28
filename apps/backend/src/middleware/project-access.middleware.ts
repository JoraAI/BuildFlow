/**
 * Project-scoped access checks.
 */
import { NextFunction, Request, Response } from 'express';
import type { Role } from '@buildflow/shared';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';

export async function assertProjectAccess(
  companyId: string,
  userId: string,
  role: Role,
  projectId: string,
  allowedRoles?: Role[],
): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId, isDeleted: false },
  });
  if (!project) throw ApiError.notFound('Project not found');

  if (role === 'OWNER') return;

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!member) throw ApiError.forbidden('You are not assigned to this project');

  if (allowedRoles && !allowedRoles.includes(member.role)) {
    throw ApiError.forbidden(`This action requires project role: ${allowedRoles.join(', ')}`);
  }
}

export function requireProjectRole(...roles: Role[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(ApiError.unauthorized());
      const projectId = req.params.id ?? req.params.projectId;
      if (!projectId) return next(ApiError.badRequest('Project id required'));
      await assertProjectAccess(req.user.companyId, req.user.id, req.user.role, projectId, roles);
      next();
    } catch (err) {
      next(err);
    }
  };
}

export async function getAccessibleProjectIds(
  companyId: string,
  userId: string,
  role: Role,
): Promise<string[] | null> {
  if (role === 'OWNER') return null;
  const rows = await prisma.projectMember.findMany({
    where: { userId, project: { companyId, isDeleted: false } },
    select: { projectId: true },
  });
  return rows.map((r) => r.projectId);
}
