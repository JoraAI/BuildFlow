/**
 * BuildFlow — User invite service (team onboarding).
 */
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { hashPassword } from '../utils/password';
import { generateInviteToken, hashInviteToken } from '../utils/invite-token';
import { recordAudit } from '../utils/audit';
import { signAccessToken, signRefreshToken } from '../utils/jwt';
import { env } from '../config/env';
import { Role } from '@buildflow/shared';
import type { AcceptInviteInput, CreateUserInviteInput } from '@buildflow/shared';
import type { AuthResponse } from './auth.service';

const ACCESS_EXPIRES_SECONDS = 15 * 60;

function issueTokens(payload: { sub: string; companyId: string; role: Role }) {
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  return { accessToken, refreshToken, expiresIn: ACCESS_EXPIRES_SECONDS };
}

export async function createInvite(
  companyId: string,
  invitedById: string,
  input: CreateUserInviteInput,
): Promise<{ inviteId: string; token: string; inviteUrl: string; expiresAt: Date }> {
  const email = input.email.toLowerCase();

  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) throw ApiError.conflict('A user with this email already exists');

  const pending = await prisma.userInvite.findFirst({
    where: { companyId, email, acceptedAt: null, expiresAt: { gt: new Date() } },
  });
  if (pending) throw ApiError.conflict('A pending invite already exists for this email');

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
    role: invite.role as 'PM' | 'SUPERVISOR' | 'ACCOUNTANT',
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
    include: { company: { select: { name: true, logoUrl: true } } },
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
  const companyMeta = invite.company as { name: string; logoUrl: string | null };
  const { resolveLogoDisplayUrl } = await import('./settings.service');
  const companyLogoUrl = await resolveLogoDisplayUrl(user.companyId, companyMeta.logoUrl);

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
    },
    ...tokens,
  };
}
