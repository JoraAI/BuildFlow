/**
 * BuildFlow - Settings service.
 *
 * Company profile, Users & Roles management, and Audit Log queries.
 * All queries are company-scoped via the ALS middleware.
 */
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { randomUUID } from 'crypto';
import {
  buildS3Key,
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
  keyToLogicalUrlForCompany,
  logicalUrlToKey,
} from '../lib/s3';

export async function resolveLogoDisplayUrl(companyId: string, logoUrl: string | null): Promise<string | null> {
  if (!logoUrl) return null;
  if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) return logoUrl;
  const parsed = logicalUrlToKey(logoUrl);
  if (!parsed) return null;
  try {
    return await getPresignedDownloadUrl({ companyId, key: parsed.key });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// My Profile (self-service)
// ---------------------------------------------------------------------------
export async function getMyProfile(userId: string, companyId: string) {
  const user = await prisma.user.findFirstOrThrow({
    where: { id: userId, companyId },
    include: { company: { select: { name: true, logoUrl: true } } },
  });
  const companyLogoUrl = await resolveLogoDisplayUrl(user.companyId, user.company.logoUrl);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role as string,
    companyId: user.companyId,
    companyName: user.company.name,
    companyLogoUrl,
  };
}

export async function updateMyProfile(
  userId: string,
  companyId: string,
  data: { name?: string; phone?: string | null },
) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
    },
    include: { company: { select: { name: true, logoUrl: true } } },
  });
  if (user.companyId !== companyId) throw ApiError.forbidden();
  const companyLogoUrl = await resolveLogoDisplayUrl(user.companyId, user.company.logoUrl);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role as string,
    companyId: user.companyId,
    companyName: user.company.name,
    companyLogoUrl,
  };
}

export async function createCompanyLogoUploadUrl(
  companyId: string,
  input: { filename: string; contentType: string },
) {
  const ext = input.filename.split('.').pop() ?? 'png';
  const filename = `${randomUUID()}.${ext}`;
  const key = buildS3Key({ companyId, entityType: 'company-logo', filename });
  const uploadUrl = await getPresignedUploadUrl({ companyId, key, contentType: input.contentType });
  const logoUrl = await keyToLogicalUrlForCompany(companyId, key);
  return { uploadUrl, logoUrl };
}

// ---------------------------------------------------------------------------
// Company Profile
// ---------------------------------------------------------------------------
export async function getCompanyProfile(companyId: string) {
  const company = await prisma.company.findUniqueOrThrow({
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
  const logoDisplayUrl = await resolveLogoDisplayUrl(companyId, company.logoUrl);
  return { ...company, logoDisplayUrl };
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
  const company = await prisma.company.update({
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
  const logoDisplayUrl = await resolveLogoDisplayUrl(companyId, company.logoUrl);
  return { ...company, logoDisplayUrl };
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
  // FIX (SEC-M15): add companyId to the lastActive lookup — previously filtered
  // by userId only, so a caller could learn another tenant's user's last-activity.
  const [actionCount, lastActive] = await Promise.all([
    prisma.auditLog.count({ where: { userId, companyId } }),
    prisma.auditLog.findFirst({
      where: { userId, companyId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);
  return { actionCount, lastActive: lastActive?.createdAt.toISOString() ?? null };
}

export interface UserUpdateInput {
  name?: string;
  phone?: string;
  role?: string;
  isActive?: boolean;
}

export async function updateUser(
  targetUserId: string,
  companyId: string,
  data: UserUpdateInput,
  callerUserId?: string,
) {
  // FIX (SEC-H8): forbid assigning the OWNER role via this endpoint (privilege
  // escalation), and block self-role-changes.
  const existing = await prisma.user.findFirstOrThrow({ where: { id: targetUserId, companyId } });

  // Block self-role changes.
  if (data.role && callerUserId === targetUserId) {
    throw new ApiError('FORBIDDEN', 'You cannot change your own role');
  }

  // Forbid assigning OWNER — only company creation can create an OWNER.
  if (data.role === 'OWNER') {
    throw new ApiError('FORBIDDEN', 'Cannot assign the OWNER role via this endpoint');
  }
  // FIX (NR-16): Normalize the legacy SUPERVISOR enum value to the current
  // SITE_SUPERVISOR (DAT-4.2 intent). The previous code was inverted — it
  // mapped the NEW value back to the DEPRECATED one.
  if (data.role === 'SUPERVISOR') {
    data.role = 'SITE_SUPERVISOR';
  }

  // Prevent a user from deactivating themselves or removing their own OWNER role.
  if (data.role && existing.role === 'OWNER' && data.role !== 'OWNER') {
    throw new ApiError('FORBIDDEN', 'Cannot demote an OWNER role');
  }
  if (data.isActive === false && existing.role === 'OWNER') {
    throw new ApiError('FORBIDDEN', 'Cannot deactivate an OWNER');
  }
  return prisma.user.update({
    where: { id: targetUserId },
    data: { ...data, role: data.role as never },
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