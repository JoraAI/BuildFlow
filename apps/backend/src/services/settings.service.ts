/**
 * BuildFlow - Settings service.
 *
 * Company profile, Users & Roles management, and Audit Log queries.
 * All queries are company-scoped via the ALS middleware.
 */
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { recordAudit } from '../utils/audit';
import { randomUUID } from 'crypto';
import {
  INVITABLE_ROLES_BY_PRODUCT,
  isSyntheticPhoneEmail,
  normalizePhone,
  phoneLookupVariants,
  type Role,
  type InventoryBusinessProfile,
  type MyProfileUpdateInput,
  type ProfileContactOtpInput,
} from '@buildflow/shared';
import {
  buildS3Key,
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
  isTenantObjectKey,
  keyToLogicalUrlForCompany,
  logicalUrlToKey,
} from '../lib/s3';
import { consumeOtp, issueOtp } from './otp.service';

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

function serializeMyProfile(
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: string;
    companyId: string;
    company: { name: string; logoUrl: string | null };
  },
  companyLogoUrl: string | null,
) {
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

export async function sendProfileContactOtp(
  userId: string,
  companyId: string,
  input: ProfileContactOtpInput,
) {
  const user = await prisma.user.findFirstOrThrow({ where: { id: userId, companyId } });
  let destination: string;
  let channel: 'email' | 'sms';
  if (input.channel === 'email') {
    destination = input.destination.trim().toLowerCase();
    if (!destination.includes('@') || isSyntheticPhoneEmail(destination)) {
      throw ApiError.badRequest('Enter a valid email address');
    }
    if (destination === user.email.toLowerCase()) {
      throw ApiError.badRequest('That email is already on your account');
    }
    channel = 'email';
  } else {
    destination = normalizePhone(input.destination);
    if (user.phone && phoneLookupVariants(user.phone).includes(destination)) {
      throw ApiError.badRequest('That mobile number is already on your account');
    }
    channel = 'sms';
  }

  return issueOtp({
    purpose: 'profile_contact',
    key: `${userId}:${channel}:${destination}`,
    channel,
    destination,
    companyId,
    messagePrefix:
      channel === 'sms'
        ? 'StaffingPros: Your BuildFlow verification code is'
        : 'Your BuildFlow verification code is',
    emailSubject: 'Verify your BuildFlow email',
  });
}

export async function updateMyProfile(
  userId: string,
  companyId: string,
  data: MyProfileUpdateInput,
) {
  const existing = await prisma.user.findFirstOrThrow({
    where: { id: userId, companyId },
    include: { company: { select: { name: true, logoUrl: true } } },
  });

  const nextName = data.name !== undefined ? data.name.trim() : existing.name;

  let nextEmail = existing.email;
  let emailChanged = false;
  if (data.email !== undefined) {
    if (data.email === null || data.email === '') {
      throw ApiError.badRequest('Email cannot be cleared. Add a mobile number first, or keep your email.');
    }
    const normalized = data.email.trim().toLowerCase();
    if (isSyntheticPhoneEmail(normalized)) {
      throw ApiError.badRequest('Enter a real email address');
    }
    if (normalized !== existing.email.toLowerCase()) {
      emailChanged = true;
      nextEmail = normalized;
    }
  }

  let nextPhone: string | null = existing.phone;
  let phoneChanged = false;
  if (data.phone !== undefined) {
    if (data.phone === null || data.phone.trim() === '') {
      nextPhone = null;
      phoneChanged = Boolean(existing.phone);
    } else {
      const normalized = normalizePhone(data.phone);
      const same =
        existing.phone != null && phoneLookupVariants(existing.phone).includes(normalized);
      if (!same) {
        phoneChanged = true;
        nextPhone = normalized;
      }
    }
  }

  // Must keep at least one real login identifier.
  const hasRealEmail = !isSyntheticPhoneEmail(nextEmail);
  if (!hasRealEmail && !nextPhone) {
    throw ApiError.badRequest('Keep a mobile number or add a real email so you can sign in.');
  }
  if (phoneChanged && nextPhone === null && !hasRealEmail) {
    throw ApiError.badRequest('Add a real email before removing your mobile number.');
  }

  if (emailChanged) {
    if (!data.emailOtp?.trim()) {
      throw ApiError.badRequest('Enter the OTP sent to your new email');
    }
    await consumeOtp({
      purpose: 'profile_contact',
      key: `${userId}:email:${nextEmail}`,
      code: data.emailOtp.trim(),
      expectedDestination: nextEmail,
    });
    const taken = await prisma.user.findFirst({
      where: {
        email: nextEmail,
        isActive: true,
        NOT: { id: userId },
      },
      select: { id: true },
    });
    if (taken) throw ApiError.conflict('Email already registered');
  }

  if (phoneChanged && nextPhone) {
    if (!data.phoneOtp?.trim()) {
      throw ApiError.badRequest('Enter the OTP sent to your new mobile number');
    }
    await consumeOtp({
      purpose: 'profile_contact',
      key: `${userId}:sms:${nextPhone}`,
      code: data.phoneOtp.trim(),
      expectedDestination: nextPhone,
    });
    const variants = phoneLookupVariants(nextPhone);
    const taken = await prisma.user.findFirst({
      where: {
        phone: { in: variants },
        isActive: true,
        NOT: { id: userId },
      },
      select: { id: true },
    });
    if (taken) throw ApiError.conflict('Mobile number already registered');
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      name: nextName,
      ...(emailChanged ? { email: nextEmail } : {}),
      ...(data.phone !== undefined ? { phone: nextPhone } : {}),
    },
    include: { company: { select: { name: true, logoUrl: true } } },
  });
  if (user.companyId !== companyId) throw ApiError.forbidden();
  const companyLogoUrl = await resolveLogoDisplayUrl(user.companyId, user.company.logoUrl);
  return serializeMyProfile(user, companyLogoUrl);
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
      subscriptionPlan: true,
      inventoryProfile: true,
      inventoryVertical: true,
      catalogSeededAt: true,
      creditLimitPolicy: true,
      poAutoApproveBelow: true,
      poOwnerApproveAbove: true,
      auditorPackCadence: true,
      auditorPackDay: true,
    },
  });
  const logoDisplayUrl = await resolveLogoDisplayUrl(companyId, company.logoUrl);
  const isInventory = company.subscriptionPlan === 'INVENTORY';
  return {
    ...company,
    logoDisplayUrl,
    // INVENTORY_HORIZONTAL_PLATFORM (Phase 0): hidden on construction plans.
    inventoryProfile: isInventory ? (company.inventoryProfile ?? 'GENERAL') : null,
    // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.1): inventory-only vertical.
    inventoryVertical: isInventory ? company.inventoryVertical : null,
    catalogSeededAt: isInventory ? company.catalogSeededAt : null,
    // INVENTORY_HORIZONTAL_PLATFORM (Phase 2.5): inventory-only policy.
    creditLimitPolicy: isInventory ? company.creditLimitPolicy : null,
    // INVENTORY_HORIZONTAL_PLATFORM (Phase 4.4): inventory-only PO thresholds.
    poAutoApproveBelow: isInventory ? Number(company.poAutoApproveBelow) : null,
    poOwnerApproveAbove: isInventory ? Number(company.poOwnerApproveAbove) : null,
    auditorPackCadence: isInventory ? company.auditorPackCadence : null,
    auditorPackDay: isInventory ? company.auditorPackDay : null,
  };
}

export interface CompanyUpdateInput {
  name?: string;
  gstin?: string;
  pan?: string;
  address?: string;
  logoUrl?: string | null;
  state?: string;
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 0): inventory-only field.
  inventoryProfile?: InventoryBusinessProfile;
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 2.5): credit-limit policy (inventory only).
  creditLimitPolicy?: 'ALLOW' | 'WARN' | 'BLOCK';
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 4.4): PO approval thresholds (₹).
  poAutoApproveBelow?: number;
  poOwnerApproveAbove?: number;
  auditorPackCadence?: 'MONTHLY' | 'QUARTERLY';
  auditorPackDay?: number;
}

// RPT-C2a: Report settings API
export async function getReportSettings(companyId: string) {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { reportSettings: true },
  });
  return (company.reportSettings as Record<string, unknown>) ?? {};
}

export async function updateReportSettings(companyId: string, settings: Record<string, unknown>) {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { reportSettings: true },
  });
  const existing = (company.reportSettings as Record<string, unknown>) ?? {};
  // RPT-C2b: Store merged object directly (Prisma Json accepts objects)
  const merged = { ...existing, ...settings };
  await prisma.company.update({
    where: { id: companyId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { reportSettings: merged as any },
  });
  return merged;
}

export async function updateCompanyProfile(companyId: string, data: CompanyUpdateInput) {
  if (data.logoUrl) {
    const parsed = logicalUrlToKey(data.logoUrl);
    if (parsed && !isTenantObjectKey(companyId, parsed.key)) {
      throw ApiError.badRequest('Logo file must belong to this company');
    }
  }
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 0/2.5/4.4): inventory-only fields.
  // Construction companies must ignore them (hidden fields) - never write them.
  let write: Record<string, unknown> = { ...data };
  if (
    data.inventoryProfile !== undefined ||
    data.creditLimitPolicy !== undefined ||
    data.poAutoApproveBelow !== undefined ||
    data.poOwnerApproveAbove !== undefined ||
    data.auditorPackCadence !== undefined ||
    data.auditorPackDay !== undefined
  ) {
    const current = await prisma.company.findUnique({
      where: { id: companyId },
      select: { subscriptionPlan: true },
    });
    if (current?.subscriptionPlan !== 'INVENTORY') {
      delete write.inventoryProfile;
      delete write.creditLimitPolicy;
      delete write.poAutoApproveBelow;
      delete write.poOwnerApproveAbove;
      delete write.auditorPackCadence;
      delete write.auditorPackDay;
    }
  }
  const company = await prisma.company.update({
    where: { id: companyId },
    data: write as CompanyUpdateInput,
    select: {
      id: true,
      name: true,
      gstin: true,
      pan: true,
      address: true,
      logoUrl: true,
      state: true,
      subscriptionPlan: true,
      inventoryProfile: true,
      creditLimitPolicy: true,
      poAutoApproveBelow: true,
      poOwnerApproveAbove: true,
      auditorPackCadence: true,
      auditorPackDay: true,
    },
  });
  const logoDisplayUrl = await resolveLogoDisplayUrl(companyId, company.logoUrl);
  const isInventory = company.subscriptionPlan === 'INVENTORY';
  return {
    ...company,
    logoDisplayUrl,
    inventoryProfile: isInventory ? (company.inventoryProfile ?? 'GENERAL') : null,
    creditLimitPolicy: isInventory ? company.creditLimitPolicy : null,
    poAutoApproveBelow: isInventory ? Number(company.poAutoApproveBelow) : null,
    poOwnerApproveAbove: isInventory ? Number(company.poOwnerApproveAbove) : null,
    auditorPackCadence: isInventory ? company.auditorPackCadence : null,
    auditorPackDay: isInventory ? company.auditorPackDay : null,
  };
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
  const [users, auditorLinks] = await Promise.all([
    prisma.user.findMany({
      where: {
        companyId,
        NOT: { email: { endsWith: '@deleted.buildflow.local' } },
      },
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
    }),
    // Multi-shop auditors may have companyId set to another shop; still list them here.
    prisma.auditorMembership.findMany({
      where: { companyId, isActive: true },
      select: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    }),
  ]);

  const byId = new Map<string, UserRow>();
  for (const u of users) {
    byId.set(u.id, {
      ...u,
      role: u.role as string,
      createdAt: u.createdAt.toISOString(),
    });
  }
  for (const link of auditorLinks) {
    const u = link.user;
    if (u.email.endsWith('@deleted.buildflow.local')) continue;
    if (!byId.has(u.id)) {
      byId.set(u.id, {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: 'AUDITOR',
        isActive: u.isActive,
        createdAt: u.createdAt.toISOString(),
      });
    }
  }
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getUserAuditStats(userId: string, companyId: string) {
  // FIX (SEC-M15): add companyId to the lastActive lookup - previously filtered
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

  // INVENTORY_PRODUCT: enforce role allow-list on role changes too.
  if (data.role) {
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { subscriptionPlan: true },
    });
    const productMode = company.subscriptionPlan === 'INVENTORY' ? 'inventory' : 'construction';
    const allowed = INVITABLE_ROLES_BY_PRODUCT[productMode];
    if (!allowed.includes(data.role as Role)) {
      throw new ApiError(
        'FORBIDDEN',
        productMode === 'inventory'
          ? 'Inventory accounts can only have OWNER, INVENTORY_MANAGER, or AUDITOR roles.'
          : 'This role is not available for construction accounts.',
      );
    }
  }

  // Block self-role changes.
  if (data.role && callerUserId === targetUserId) {
    throw new ApiError('FORBIDDEN', 'You cannot change your own role');
  }

  // Forbid assigning OWNER - only company creation can create an OWNER.
  if (data.role === 'OWNER') {
    throw new ApiError('FORBIDDEN', 'Cannot assign the OWNER role via this endpoint');
  }
  // FIX (NR-16): Normalize the legacy SUPERVISOR enum value to the current
  // SITE_SUPERVISOR (DAT-4.2 intent). The previous code was inverted - it
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
  if (data.isActive === false && callerUserId === targetUserId) {
    throw new ApiError('FORBIDDEN', 'You cannot deactivate your own account');
  }

  if (existing.role === 'AUDITOR' && data.role && data.role !== 'AUDITOR') {
    throw new ApiError(
      'FORBIDDEN',
      'Remove the auditor from this shop instead of changing their role',
    );
  }

  if (data.role === 'AUDITOR' && existing.role !== 'AUDITOR') {
    const { assertAuditorSlotAvailable, ensureAuditorMembership } = await import('./auditor.service');
    await assertAuditorSlotAvailable(companyId);
    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { ...data, role: data.role as never },
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true },
    });
    await ensureAuditorMembership({
      userId: targetUserId,
      companyId,
      invitedById: callerUserId ?? null,
    });
    return updated;
  }

  return prisma.user.update({
    where: { id: targetUserId },
    data: { ...data, role: data.role as never },
    select: { id: true, name: true, email: true, phone: true, role: true, isActive: true },
  });
}

/**
 * Remove a teammate from this organisation. Frees email/mobile so they can
 * accept an invite into another company as a fresh signup.
 */
export async function deleteTeamUser(
  targetUserId: string,
  companyId: string,
  callerUserId: string,
): Promise<{ deleted: true }> {
  const existing = await prisma.user.findFirst({ where: { id: targetUserId, companyId } });
  const auditorLink = existing
    ? null
    : await prisma.auditorMembership.findUnique({
        where: { userId_companyId: { userId: targetUserId, companyId } },
        select: { isActive: true, user: true },
      });
  const target = existing ?? (auditorLink?.isActive ? auditorLink.user : null);
  if (!target) throw ApiError.notFound('User not found');
  if (target.role === 'OWNER') {
    throw new ApiError('FORBIDDEN', 'Cannot delete the OWNER account');
  }
  if (callerUserId === targetUserId) {
    throw new ApiError('FORBIDDEN', 'You cannot delete your own account');
  }

  if (target.role === 'AUDITOR') {
    const { revokeAuditorMembership } = await import('./auditor.service');
    await revokeAuditorMembership(companyId, targetUserId, callerUserId);
  } else {
    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        isActive: false,
        email: `deleted.${targetUserId.replace(/-/g, '')}@deleted.buildflow.local`,
        phone: null,
      },
    });
  }

  await recordAudit({
    companyId,
    userId: callerUserId,
    action: 'DELETE',
    entityType: 'user',
    entityId: targetUserId,
    oldValue: {
      email: target.email,
      phone: target.phone,
      role: target.role,
      name: target.name,
    },
  });

  return { deleted: true };
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
  opts: {
    page: number;
    limit: number;
    userId?: string;
    entityType?: string;
    action?: string;
    q?: string;
  },
): Promise<{ rows: AuditLogRow[]; total: number }> {
  const { page, limit, userId, entityType, action, q } = opts;
  const query = q?.trim();
  const where = {
    companyId,
    ...(userId ? { userId } : {}),
    ...(entityType ? { entityType } : {}),
    ...(action ? { action } : {}),
    ...(query
      ? {
          OR: [
            { entityType: { contains: query, mode: 'insensitive' as const } },
            { action: { contains: query, mode: 'insensitive' as const } },
            { entityId: { contains: query, mode: 'insensitive' as const } },
            { user: { name: { contains: query, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
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
  const [
    company,
    users,
    projects,
    resources,
    rateAnalyses,
    estimates,
    invoices,
    bills,
    reports,
    customers,
    vendors,
    cashBookEntries,
    cashBookCategories,
    salesOrders,
    purchaseOrders,
    goodsReceipts,
    stockLocations,
  ] = await Promise.all([
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
    prisma.customer.findMany({ where: { companyId } }),
    prisma.vendor.findMany({ where: { companyId } }),
    prisma.inventoryCashBookEntry.findMany({ where: { companyId } }),
    prisma.inventoryCashBookCategory.findMany({ where: { companyId } }),
    prisma.salesOrder.findMany({ where: { companyId }, include: { lines: true } }),
    prisma.purchaseOrder.findMany({ where: { companyId }, include: { lines: true } }),
    prisma.goodsReceiptNote.findMany({ where: { companyId }, include: { lines: true } }),
    prisma.stockLocation.findMany({ where: { companyId } }),
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
    customers,
    vendors,
    cashBookEntries,
    cashBookCategories,
    salesOrders,
    purchaseOrders,
    goodsReceipts,
    stockLocations,
  };
}