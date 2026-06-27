/**
 * BuildFlow — Settings service.
 *
 * Company profile, Users & Roles management, and Audit Log queries.
 * All queries are company-scoped via the ALS middleware.
 */
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';

// ---------------------------------------------------------------------------
// Company Profile
// ---------------------------------------------------------------------------
export async function getCompanyProfile(companyId: string) {
  return prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      gstin: true,
      pan: true,
      address: true,
      logoUrl: true,
      state: true,
      createdAt: true,
    },
  });
}

export interface CompanyUpdateInput {
  name?: string;
  gstin?: string;
  pan?: string;
  address?: string;
  logoUrl?: string;
  state?: string;
}

export async function updateCompanyProfile(companyId: string, data: CompanyUpdateInput) {
  return prisma.company.update({
    where: { id: companyId },
    data,
    select: {
      id: true,
      name: true,
      gstin: true,
      pan: true,
      address: true,
      logoUrl: true,
      state: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Users & Roles
// ---------------------------------------------------------------------------
export interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export async function listUsers(companyId: string): Promise<UserRow[]> {
  const users = await prisma.user.findMany({
    where: { companyId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
  return users.map((u) => ({ ...u, role: u.role as string, createdAt: u.createdAt.toISOString() }));
}

export async function getUserAuditStats(userId: string, companyId: string) {
  const [actionCount, lastActive] = await Promise.all([
    prisma.auditLog.count({ where: { userId, companyId } }),
    prisma.auditLog.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);
  return { actionCount, lastActive: lastActive?.createdAt.toISOString() ?? null };
}

export interface UserUpdateInput {
  name?: string;
  phone?: string;
  role?: 'OWNER' | 'PM' | 'SUPERVISOR' | 'ACCOUNTANT';
  isActive?: boolean;
}

export async function updateUser(userId: string, companyId: string, data: UserUpdateInput) {
  // Prevent a user from deactivating themselves or removing their own OWNER role.
  const existing = await prisma.user.findFirstOrThrow({ where: { id: userId, companyId } });
  if (data.role && existing.role === 'OWNER' && data.role !== 'OWNER') {
    throw new ApiError('FORBIDDEN', 'Cannot demote an OWNER role');
  }
  if (data.isActive === false && existing.role === 'OWNER') {
    throw new ApiError('FORBIDDEN', 'Cannot deactivate an OWNER');
  }
  return prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, name: true, email: true, phone: true, role: true, isActive: true },
  });
}

// ---------------------------------------------------------------------------
// Audit Log
// ---------------------------------------------------------------------------
export interface AuditLogRow {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export async function listAuditLogs(
  companyId: string,
  opts: { page: number; limit: number; userId?: string; entityType?: string },
): Promise<{ rows: AuditLogRow[]; total: number }> {
  const { page, limit, userId, entityType } = opts;
  const where = {
    companyId,
    ...(userId ? { userId } : {}),
    ...(entityType ? { entityType } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { user: { select: { name: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return {
    rows: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: r.user.name,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      oldValue: r.oldValue,
      newValue: r.newValue,
      ipAddress: r.ipAddress,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
  };
}

// ---------------------------------------------------------------------------
// Data Export (company-wide snapshot)
// ---------------------------------------------------------------------------
export async function exportCompanyData(companyId: string) {
  const [company, users, projects, resources, rateAnalyses, estimates, invoices, bills, reports] =
    await Promise.all([
      prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
      prisma.user.findMany({ where: { companyId } }),
      prisma.project.findMany({ where: { companyId } }),
      prisma.resource.findMany({ where: { companyId } }),
      prisma.rateAnalysis.findMany({ where: { companyId }, include: { components: true } }),
      prisma.estimate.findMany({ where: { companyId }, include: { sections: true, items: true } }),
      prisma.invoice.findMany({ where: { companyId }, include: { lineItems: true } }),
      prisma.bill.findMany({ where: { companyId } }),
      prisma.dailyReport.findMany({
        where: { project: { companyId } },
        include: { materialUsages: true },
      }),
    ]);
  return {
    exportedAt: new Date().toISOString(),
    company,
    users: users.map((u) => ({ ...u, passwordHash: '[REDACTED]' })),
    projects,
    resources,
    rateAnalyses,
    estimates,
    invoices,
    bills,
    reports,
  };
}