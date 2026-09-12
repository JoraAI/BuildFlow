/**
 * BuildFlow - User invite service (team onboarding).
 */
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { hashPassword } from '../utils/password';
import { generateInviteToken, hashInviteToken } from '../utils/invite-token';
import { recordAudit } from '../utils/audit';
import { signAccessToken, signRefreshToken, expiresInSeconds } from '../utils/jwt';
import { env } from '../config/env';
import { Role, INVITABLE_ROLES_BY_PRODUCT, normalizePhone } from '@buildflow/shared';
import type {
  AcceptInviteInput,
  CreateTeamUserInput,
  CreateUserInviteInput,
  InventoryBusinessProfile,
} from '@buildflow/shared';
import type { AuthResponse } from './auth.service';
import { assertPlanAllowsUser } from './plan-enforcement.service';

const ACCESS_EXPIRES_SECONDS = expiresInSeconds(env.JWT_ACCESS_EXPIRES_IN);

function issueTokens(payload: { sub: string; companyId: string; role: Role }) {
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  return { accessToken, refreshToken, expiresIn: ACCESS_EXPIRES_SECONDS };
}

function phoneLookupVariants(phone: string): string[] {
  const normalized = normalizePhone(phone);
  const digits = normalized.replace(/\D/g, '');
  const variants = new Set<string>([normalized, phone.trim()]);
  if (digits) {
    variants.add(digits);
    variants.add(`+${digits}`);
    if (digits.startsWith('91') && digits.length === 12) {
      variants.add(digits.slice(2));
      variants.add(`+91${digits.slice(2)}`);
    }
  }
  return [...variants];
}

async function findUserByPhone(phone: string, opts?: { activeOnly?: boolean }) {
  const variants = phoneLookupVariants(phone);
  return prisma.user.findFirst({
    where: {
      phone: { in: variants },
      ...(opts?.activeOnly ? { isActive: true } : {}),
    },
    select: { id: true, email: true, phone: true, isActive: true, companyId: true },
  });
}

function syntheticEmailFromPhone(phone: string): string {
  const digits = normalizePhone(phone).replace(/\D/g, '');
  return `u.${digits}@phone.buildflow.local`;
}

/**
 * Free email/phone on deactivated (or foreign-org) accounts so the person can
 * start fresh when invited into another organisation.
 */
async function releaseContactIfInactive(opts: {
  email?: string | null;
  phone?: string | null;
}): Promise<void> {
  const toRelease: string[] = [];

  if (opts.email) {
    const byEmail = await prisma.user.findUnique({
      where: { email: opts.email.toLowerCase() },
      select: { id: true, isActive: true },
    });
    if (byEmail && !byEmail.isActive) toRelease.push(byEmail.id);
  }

  if (opts.phone) {
    const byPhone = await findUserByPhone(opts.phone);
    if (byPhone && !byPhone.isActive) toRelease.push(byPhone.id);
  }

  const uniqueIds = [...new Set(toRelease)];
  for (const id of uniqueIds) {
    await prisma.user.update({
      where: { id },
      data: {
        email: `deleted.${id.replace(/-/g, '')}@deleted.buildflow.local`,
        phone: null,
      },
    });
  }
}

/**
 * Active users block reuse. Inactive users are released so a new org invite
 * can create a fresh membership (login will only reflect the new org).
 */
async function assertContactAvailableForActiveUser(opts: {
  email?: string | null;
  phone?: string | null;
}): Promise<void> {
  if (opts.email) {
    const existing = await prisma.user.findUnique({
      where: { email: opts.email.toLowerCase() },
      select: { id: true, isActive: true },
    });
    if (existing?.isActive) {
      throw ApiError.conflict('A user with this email already exists');
    }
  }
  if (opts.phone) {
    const existingPhone = await findUserByPhone(opts.phone, { activeOnly: true });
    if (existingPhone) {
      throw ApiError.conflict('A user with this mobile number already exists');
    }
  }
  await releaseContactIfInactive(opts);
}

/**
 * INVENTORY_PRODUCT: enforce role allow-list per plan family.
 *   INVENTORY → OWNER + INVENTORY_MANAGER only.
 *   Construction → existing roles except INVENTORY_MANAGER.
 */
async function assertInvitableRole(companyId: string, role: string): Promise<void> {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { subscriptionPlan: true },
  });
  const productMode = company.subscriptionPlan === 'INVENTORY' ? 'inventory' : 'construction';
  const allowed = INVITABLE_ROLES_BY_PRODUCT[productMode];
  if (!allowed.includes(role as Role)) {
    throw ApiError.badRequest(
      productMode === 'inventory'
        ? 'Inventory accounts can only invite OWNER or INVENTORY_MANAGER roles.'
        : 'This role is not available for construction accounts.',
    );
  }
}

export async function createInvite(
  companyId: string,
  invitedById: string,
  input: CreateUserInviteInput,
): Promise<{ inviteId: string; token: string; inviteUrl: string; expiresAt: Date }> {
  const email = input.email?.toLowerCase() || null;
  const phone = input.phone ? normalizePhone(input.phone) : null;

  if (!email && !phone) {
    throw ApiError.badRequest('Email or mobile number is required');
  }

  await assertInvitableRole(companyId, input.role);

  if (email || phone) {
    await assertContactAvailableForActiveUser({ email, phone });
  }

  if (email) {
    const pending = await prisma.userInvite.findFirst({
      where: { companyId, email, acceptedAt: null, expiresAt: { gt: new Date() } },
    });
    if (pending) throw ApiError.conflict('A pending invite already exists for this email');
  }

  if (phone) {
    const pendingPhone = await prisma.userInvite.findFirst({
      where: { companyId, phone, acceptedAt: null, expiresAt: { gt: new Date() } },
    });
    if (pendingPhone) throw ApiError.conflict('A pending invite already exists for this mobile number');
  }

  // SUB-PLAN1: Enforce plan user limit before creating invite
  await assertPlanAllowsUser(companyId);

  const { token, tokenHash } = generateInviteToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.INVITE_TOKEN_EXPIRES_DAYS);

  const invite = await prisma.userInvite.create({
    data: {
      companyId,
      email,
      phone,
      role: input.role,
      tokenHash,
      invitedById,
      expiresAt,
    },
  });

  await recordAudit({
    companyId,
    userId: invitedById,
    action: 'CREATE',
    entityType: 'user_invite',
    entityId: invite.id,
    newValue: { email, phone, role: input.role },
  });

  const inviteUrl = `${env.APP_PUBLIC_URL}/signup/invite?token=${encodeURIComponent(token)}`;

  return { inviteId: invite.id, token, inviteUrl, expiresAt };
}

/**
 * Owner creates a user with a password they can share directly (no invite link).
 */
export async function createTeamUser(
  companyId: string,
  createdById: string,
  input: CreateTeamUserInput,
): Promise<{
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  loginHint: string;
}> {
  if (input.role === 'OWNER') {
    throw ApiError.badRequest('Cannot create another OWNER via this endpoint');
  }

  await assertInvitableRole(companyId, input.role);
  await assertPlanAllowsUser(companyId);

  const phone = input.phone ? normalizePhone(input.phone) : null;
  let email = input.email?.toLowerCase() || null;

  if (!email && !phone) {
    throw ApiError.badRequest('Email or mobile number is required');
  }

  if (!email && phone) {
    email = syntheticEmailFromPhone(phone);
  }

  await assertContactAvailableForActiveUser({ email, phone });

  const passwordHash = await hashPassword(input.password);

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { defaultProjectId: true },
  });

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        companyId,
        name: input.name,
        email: email!,
        phone,
        passwordHash,
        role: input.role,
      },
    });

    if (company.defaultProjectId) {
      await tx.projectMember.create({
        data: {
          projectId: company.defaultProjectId,
          userId: created.id,
          role: input.role,
        },
      });
    }

    return created;
  });

  await recordAudit({
    companyId,
    userId: createdById,
    action: 'CREATE',
    entityType: 'user',
    entityId: user.id,
    newValue: { email: user.email, phone: user.phone, role: user.role, createdWithPassword: true },
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    loginHint: phone ?? user.email,
  };
}

export async function listPendingInvites(companyId: string) {
  return prisma.userInvite.findMany({
    where: { companyId, acceptedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      phone: true,
      role: true,
      expiresAt: true,
      createdAt: true,
      invitedBy: { select: { name: true } },
    },
  });
}

export async function revokeInvite(companyId: string, inviteId: string, userId: string) {
  const invite = await prisma.userInvite.findFirst({
    where: { id: inviteId, companyId, acceptedAt: null },
  });
  if (!invite) throw ApiError.notFound('Invite not found or already accepted');

  await prisma.userInvite.delete({ where: { id: inviteId } });

  await recordAudit({
    companyId,
    userId,
    action: 'DELETE',
    entityType: 'user_invite',
    entityId: inviteId,
    oldValue: { email: invite.email, phone: invite.phone },
  });
}

export async function resendInvite(
  companyId: string,
  inviteId: string,
  invitedById: string,
): Promise<{ inviteId: string; token: string; inviteUrl: string; expiresAt: Date }> {
  const invite = await prisma.userInvite.findFirst({
    where: { id: inviteId, companyId, acceptedAt: null },
  });
  if (!invite) throw ApiError.notFound('Invite not found or already accepted');

  await prisma.userInvite.delete({ where: { id: inviteId } });

  return createInvite(companyId, invitedById, {
    email: invite.email ?? undefined,
    phone: invite.phone ?? undefined,
    role: invite.role as CreateUserInviteInput['role'],
  });
}

export async function getInvitePreview(token: string) {
  if (!/^[A-Za-z0-9_-]{32,}$/.test(token)) {
    throw ApiError.notFound('Invite not found or already used');
  }

  const tokenHash = hashInviteToken(token);
  const invite = await prisma.userInvite.findUnique({
    where: { tokenHash },
    include: { company: { select: { name: true, logoUrl: true } } },
  });

  if (!invite || invite.acceptedAt) throw ApiError.notFound('Invite not found or already used');
  if (invite.expiresAt < new Date()) throw ApiError.badRequest('Invite has expired');

  return {
    email: invite.email,
    phone: invite.phone,
    role: invite.role,
    companyName: invite.company.name,
    expiresAt: invite.expiresAt,
    /** Phone invites only need name + password; email invites lock the invite email. */
    inviteChannel: invite.email ? 'email' : 'phone',
  };
}

export async function sendInviteOtp(token: string): Promise<{
  sent: true;
  expiresInSec: number;
  phoneMasked: string;
  devCode?: string;
}> {
  if (!/^[A-Za-z0-9_-]{32,}$/.test(token)) {
    throw ApiError.notFound('Invite not found or already used');
  }
  const tokenHash = hashInviteToken(token);
  const invite = await prisma.userInvite.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      phone: true,
      email: true,
      companyId: true,
      acceptedAt: true,
      expiresAt: true,
    },
  });
  if (!invite || invite.acceptedAt) throw ApiError.notFound('Invite not found or already used');
  if (invite.expiresAt < new Date()) throw ApiError.badRequest('Invite has expired');
  if (!invite.phone) {
    throw ApiError.badRequest('OTP is only available for mobile invites');
  }

  const phone = normalizePhone(invite.phone);
  const result = await (
    await import('./otp.service')
  ).issueOtp({
    purpose: 'invite',
    key: tokenHash,
    phone,
    companyId: invite.companyId,
    messagePrefix: 'Your BuildFlow invite code is',
  });

  const digits = phone.replace(/\D/g, '');
  const phoneMasked =
    digits.length >= 4 ? `******${digits.slice(-4)}` : phone;

  return { ...result, phoneMasked };
}

export async function acceptInvite(
  input: AcceptInviteInput,
  ipAddress?: string,
): Promise<AuthResponse> {
  if (!/^[A-Za-z0-9_-]{32,}$/.test(input.token)) {
    throw ApiError.notFound('Invite not found or already used');
  }

  const tokenHash = hashInviteToken(input.token);
  const invite = await prisma.userInvite.findUnique({
    where: { tokenHash },
    include: {
      company: {
        select: {
          name: true,
          logoUrl: true,
          subscriptionPlan: true,
          defaultProjectId: true,
          inventoryProfile: true,
        },
      },
    },
  });

  if (!invite || invite.acceptedAt) throw ApiError.notFound('Invite not found or already used');
  if (invite.expiresAt < new Date()) throw ApiError.badRequest('Invite has expired');

  const phone = invite.phone ? normalizePhone(invite.phone) : null;
  const isPhoneInvite = Boolean(phone) && !invite.email;
  const method = input.method ?? 'password';

  if (isPhoneInvite && method === 'otp') {
    if (!input.otp) throw ApiError.badRequest('OTP is required');
    const { consumeOtp } = await import('./otp.service');
    await consumeOtp({
      purpose: 'invite',
      key: tokenHash,
      code: input.otp,
      expectedPhone: phone!,
    });
  } else if (method === 'otp') {
    throw ApiError.badRequest('OTP signup is only available for mobile invites');
  } else if (!input.password) {
    throw ApiError.badRequest('Password is required');
  }

  // Email invites use the invite email (locked). Phone invites use a synthetic
  // internal email; the invite phone is locked and stored on the user.
  const email = (
    invite.email ??
    (phone ? syntheticEmailFromPhone(phone) : null)
  )?.toLowerCase();

  if (!email) {
    throw ApiError.badRequest('Invite is missing contact details');
  }

  await assertContactAvailableForActiveUser({ email, phone });

  const { generateRandomPassword } = await import('./otp.service');
  const passwordPlain =
    method === 'otp' ? generateRandomPassword() : input.password!;
  const passwordHash = await hashPassword(passwordPlain);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        companyId: invite.companyId,
        name: input.name,
        email,
        phone,
        passwordHash,
        role: invite.role,
      },
    });

    // INVENTORY_PRODUCT: invited users of an inventory company are auto-added
    // as members of the single default STORE project so project-scoped routes
    // (procurement, stock, invoices, bills) pass the project-access check.
    if (invite.company.defaultProjectId) {
      await tx.projectMember.create({
        data: {
          projectId: invite.company.defaultProjectId,
          userId: created.id,
          role: invite.role,
        },
      });
    }

    await tx.userInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });

    return created;
  });

  await recordAudit({
    companyId: invite.companyId,
    userId: user.id,
    action: 'CREATE',
    entityType: 'user',
    entityId: user.id,
    newValue: {
      email: user.email,
      phone: user.phone,
      role: user.role,
      joinMethod: method,
    },
    ipAddress,
  });

  const tokens = issueTokens({ sub: user.id, companyId: user.companyId, role: user.role });
  const companyMeta = invite.company as {
    name: string;
    logoUrl: string | null;
    subscriptionPlan: string;
    defaultProjectId: string | null;
    inventoryProfile: InventoryBusinessProfile | null;
  };
  const { resolveLogoDisplayUrl } = await import('./settings.service');
  const { getRolePermissions } = await import('../lib/permissions');
  const { getProductMode, PLAN_MODULES, InventoryBusinessProfile } = await import('@buildflow/shared');
  const [companyLogoUrl, permissions] = await Promise.all([
    resolveLogoDisplayUrl(user.companyId, companyMeta.logoUrl),
    getRolePermissions(user.companyId, user.role),
  ]);
  const planKey = companyMeta.subscriptionPlan as keyof typeof PLAN_MODULES;

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      companyName: companyMeta.name,
      phone: user.phone,
      companyLogoUrl,
      permissions,
      productMode: getProductMode(companyMeta.subscriptionPlan),
      defaultProjectId: companyMeta.defaultProjectId,
      enabledModules: [...(PLAN_MODULES[planKey] ?? PLAN_MODULES.STARTER)],
      subscriptionPlan: companyMeta.subscriptionPlan,
      inventoryProfile:
        getProductMode(companyMeta.subscriptionPlan) === 'inventory'
          ? (companyMeta.inventoryProfile ?? InventoryBusinessProfile.GENERAL)
          : null,
    },
    ...tokens,
  };
}
