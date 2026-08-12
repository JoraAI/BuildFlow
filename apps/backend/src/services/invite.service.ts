/**
 * BuildFlow - User invite service (team onboarding).
 */
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { hashPassword } from '../utils/password';
import { generateInviteToken, hashInviteToken } from '../utils/invite-token';
import { recordAudit } from '../utils/audit';
import { signAccessToken, signRefreshToken } from '../utils/jwt';
import { env } from '../config/env';
import { Role, INVITABLE_ROLES_BY_PRODUCT } from '@buildflow/shared';
import type {
  AcceptInviteInput,
  CreateUserInviteInput,
  InventoryBusinessProfile,
} from '@buildflow/shared';
import type { AuthResponse } from './auth.service';
import { assertPlanAllowsUser } from './plan-enforcement.service';

const ACCESS_EXPIRES_SECONDS = 15 * 60;

function issueTokens(payload: { sub: string; companyId: string; role: Role }) {
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  return { accessToken, refreshToken, expiresIn: ACCESS_EXPIRES_SECONDS };
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
  const email = input.email.toLowerCase();

  await assertInvitableRole(companyId, input.role);

  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) throw ApiError.conflict('A user with this email already exists');

  const pending = await prisma.userInvite.findFirst({
    where: { companyId, email, acceptedAt: null, expiresAt: { gt: new Date() } },
  });
  if (pending) throw ApiError.conflict('A pending invite already exists for this email');

  // SUB-PLAN1: Enforce plan user limit before creating invite
  await assertPlanAllowsUser(companyId);

  const { token, tokenHash } = generateInviteToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.INVITE_TOKEN_EXPIRES_DAYS);

  const invite = await prisma.userInvite.create({
    data: {
      companyId,
      email,
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
    newValue: { email, role: input.role },
  });

  const inviteUrl = `${env.APP_PUBLIC_URL}/signup/invite?token=${encodeURIComponent(token)}`;

  return { inviteId: invite.id, token, inviteUrl, expiresAt };
}

export async function listPendingInvites(companyId: string) {
  return prisma.userInvite.findMany({
    where: { companyId, acceptedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
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
    oldValue: { email: invite.email },
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
    email: invite.email,
    role: invite.role as 'PM' | 'DPM' | 'QC' | 'MECHANICAL_MANAGER' | 'STORE_INCHARGE' | 'WEIGHBRIDGE_INCHARGE' | 'SITE_SUPERVISOR' | 'ACCOUNTANT',
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
    role: invite.role,
    companyName: invite.company.name,
    expiresAt: invite.expiresAt,
  };
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

  const existing = await prisma.user.findUnique({ where: { email: invite.email } });
  if (existing) throw ApiError.conflict('Email already registered');

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        companyId: invite.companyId,
        name: input.name,
        email: invite.email,
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
    newValue: { email: user.email, role: user.role },
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
      // INVENTORY_HORIZONTAL_PLATFORM (Phase 0): hidden (null) on construction.
      inventoryProfile:
        getProductMode(companyMeta.subscriptionPlan) === 'inventory'
          ? (companyMeta.inventoryProfile ?? InventoryBusinessProfile.GENERAL)
          : null,
    },
    ...tokens,
  };
}
