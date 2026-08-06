/**
 * BuildFlow - Platform admin service (cross-tenant ops).
 */
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { hashPassword, verifyPassword } from '../utils/password';
import { signPlatformAccessToken } from '../utils/jwt';
import type {
  PlatformCompanyUpdateInput,
  PlatformLoginInput,
  PlatformSubscriptionUpdateInput,
  PlatformUserUpdateInput,
} from '@buildflow/shared';

const ACCESS_EXPIRES_SECONDS = 15 * 60;

export interface PlatformAuthResponse {
  admin: { id: string; name: string; email: string };
  accessToken: string;
  expiresIn: number;
}

async function recordPlatformAudit(
  adminId: string,
  action: string,
  opts: { companyId?: string; targetId?: string; oldValue?: unknown; newValue?: unknown },
) {
  await prisma.platformAuditLog.create({
    data: {
      adminId,
      action,
      companyId: opts.companyId ?? null,
      targetId: opts.targetId ?? null,
      oldValue: opts.oldValue ?? undefined,
      newValue: opts.newValue ?? undefined,
    },
  });
}

export async function platformLogin(input: PlatformLoginInput): Promise<PlatformAuthResponse> {
  const email = input.email.trim().toLowerCase();
  const admin = await prisma.platformAdmin.findUnique({ where: { email } });
  if (!admin || !admin.isActive) {
    throw ApiError.unauthorized(
      'Invalid platform admin credentials. Use /platform/login — not the company sign-in page.',
    );
  }
  const ok = await verifyPassword(input.password, admin.passwordHash);
  if (!ok) {
    throw ApiError.unauthorized(
      'Invalid platform admin credentials. Use /platform/login — not the company sign-in page.',
    );
  }

  const accessToken = signPlatformAccessToken({ sub: admin.id });
  return {
    admin: { id: admin.id, name: admin.name, email: admin.email },
    accessToken,
    expiresIn: ACCESS_EXPIRES_SECONDS,
  };
}

export async function platformMe(adminId: string) {
  const admin = await prisma.platformAdmin.findUniqueOrThrow({
    where: { id: adminId },
    select: { id: true, name: true, email: true },
  });
  return admin;
}

export async function searchCompanies(q?: string) {
  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { gstin: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {};
  return prisma.company.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      name: true,
      gstin: true,
      subscriptionPlan: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      createdAt: true,
      _count: { select: { users: true } },
    },
  });
}

export async function getCompanyDetail(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      users: {
        select: { id: true, name: true, email: true, role: true, isActive: true, phone: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!company) throw ApiError.notFound('Company not found');
  const { getIntegrationsStatusForAdmin } = await import('./integration.service');
  const integrations = await getIntegrationsStatusForAdmin(companyId);
  return { ...company, integrations };
}

export async function updateCompanyAsAdmin(
  adminId: string,
  companyId: string,
  data: PlatformCompanyUpdateInput,
) {
  const existing = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  const updated = await prisma.company.update({ where: { id: companyId }, data });
  await recordPlatformAudit(adminId, 'UPDATE_COMPANY', {
    companyId,
    targetId: companyId,
    oldValue: existing,
    newValue: updated,
  });
  return updated;
}

export async function updateSubscriptionAsAdmin(
  adminId: string,
  companyId: string,
  data: PlatformSubscriptionUpdateInput,
) {
  const existing = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  const updated = await prisma.company.update({
    where: { id: companyId },
    data: {
      ...data,
      trialEndsAt: data.trialEndsAt === null ? null : data.trialEndsAt ? new Date(data.trialEndsAt) : undefined,
    },
  });
  await recordPlatformAudit(adminId, 'UPDATE_SUBSCRIPTION', {
    companyId,
    targetId: companyId,
    oldValue: {
      subscriptionPlan: existing.subscriptionPlan,
      subscriptionStatus: existing.subscriptionStatus,
      trialEndsAt: existing.trialEndsAt,
    },
    newValue: {
      subscriptionPlan: updated.subscriptionPlan,
      subscriptionStatus: updated.subscriptionStatus,
      trialEndsAt: updated.trialEndsAt,
    },
  });
  return updated;
}

export async function updateUserAsAdmin(
  adminId: string,
  companyId: string,
  userId: string,
  data: PlatformUserUpdateInput,
) {
  const existing = await prisma.user.findFirst({ where: { id: userId, companyId } });
  if (!existing) throw ApiError.notFound('User not found');
  const updated = await prisma.user.update({ where: { id: userId }, data });
  await recordPlatformAudit(adminId, 'UPDATE_USER', {
    companyId,
    targetId: userId,
    oldValue: existing,
    newValue: updated,
  });
  return updated;
}

export async function seedPlatformAdmin(email: string, name: string, password: string) {
  const passwordHash = await hashPassword(password);
  return prisma.platformAdmin.upsert({
    where: { email },
    update: { name, passwordHash, isActive: true },
    create: { email, name, passwordHash },
  });
}

/**
 * FIX (DAT-2.1): Company soft-delete policy.
 *
 * Rather than hard-cascading (which would lose financial records needed for
 * GST/TDS compliance), we perform a "soft deactivation":
 *   1. Set all users isActive = false
 *   2. Set subscriptionStatus = CANCELLED
 *   3. Mark all non-deleted projects as CANCELLED
 *   4. Record a PlatformAuditLog entry
 *
 * This preserves the data trail while effectively locking out the tenant.
 * The data can be purged later via a separate GDPR/compliance job if needed.
 */
export async function deactivateCompany(
  adminId: string,
  companyId: string,
  reason: string,
): Promise<{ deactivated: boolean; companyId: string }> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, subscriptionStatus: true },
  });
  if (!company) throw new Error('Company not found');

  await prisma.$transaction(async (tx) => {
    // 1. Deactivate all users
    await tx.user.updateMany({
      where: { companyId },
      data: { isActive: false },
    });

    // 2. Cancel subscription
    await tx.company.update({
      where: { id: companyId },
      data: { subscriptionStatus: 'CANCELLED' },
    });

    // 3. Cancel all active projects (soft-delete via status, not isDeleted)
    await tx.project.updateMany({
      where: { companyId, status: { in: ['PLANNING', 'IN_PROGRESS', 'ON_HOLD'] } },
      data: { status: 'CANCELLED' },
    });

    // 4. Audit log
    await tx.platformAuditLog.create({
      data: {
        adminId,
        action: 'COMPANY_DEACTIVATED',
        companyId,
        newValue: { reason, deactivatedAt: new Date().toISOString() },
      },
    });
  });

  return { deactivated: true, companyId };
}
