/**
 * BuildFlow — Auth service (business logic).
 *
 * register, login, refresh, logout, me.
 * Issues access + refresh tokens; blacklist refresh on logout.
 */
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { hashPassword, verifyPassword } from '../utils/password';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  getTokenTtlSeconds,
} from '../utils/jwt';
import { blacklistToken, isTokenBlacklisted } from '../lib/redis';
import { recordAudit } from '../utils/audit';
import { initializeTrial, notifyNewTrialSignup } from './subscription.service';
import { env } from '../config/env';
import { Role } from '@buildflow/shared';
import type { RegisterCompanyInput, LoginInput } from '@buildflow/shared';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    companyId: string;
    companyName: string;
    phone: string | null;
    companyLogoUrl: string | null;
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

async function toPublicUser(
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: Role;
    companyId: string;
    company: { name: string; logoUrl: string | null };
  },
) {
  const { resolveLogoDisplayUrl } = await import('./settings.service');
  const companyLogoUrl = await resolveLogoDisplayUrl(user.companyId, user.company.logoUrl);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    companyId: user.companyId,
    companyName: user.company.name,
    companyLogoUrl,
  };
}

const ACCESS_EXPIRES_SECONDS = 15 * 60;

function issueTokens(payload: { sub: string; companyId: string; role: Role }): AuthTokens {
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  return { accessToken, refreshToken, expiresIn: ACCESS_EXPIRES_SECONDS };
}

/* ------------------------------------------------------------------ */
/* register                                                            */
/* ------------------------------------------------------------------ */

export async function registerCompany(input: RegisterCompanyInput, ipAddress?: string): Promise<AuthResponse> {
  if (!env.ALLOW_PUBLIC_COMPANY_REGISTRATION) {
    throw ApiError.forbidden('Public company registration is disabled. Contact sales to get started.');
  }

  const existing = await prisma.user.findUnique({
    where: { email: input.ownerEmail },
    select: { id: true },
  });
  if (existing) throw ApiError.conflict('Email already registered');

  const passwordHash = await hashPassword(input.password);

  const company = await prisma.company.create({
    data: {
      name: input.companyName,
      gstin: input.gstin || '',
      pan: input.pan || '',
      address: input.address || null,
      state: input.state,
    },
  });

  await initializeTrial(company.id);

  const owner = await prisma.user.create({
    data: {
      companyId: company.id,
      name: input.ownerName,
      email: input.ownerEmail,
      passwordHash,
      role: Role.OWNER,
    },
  });

  const payload = { sub: owner.id, companyId: company.id, role: Role.OWNER };
  const tokens = issueTokens(payload);

  await recordAudit({
    companyId: company.id,
    userId: owner.id,
    action: 'CREATE',
    entityType: 'company',
    entityId: company.id,
    newValue: { name: company.name },
    ipAddress,
  });

  void notifyNewTrialSignup(company.id, company.name, owner.email);

  return {
    user: await toPublicUser({
      id: owner.id,
      name: owner.name,
      email: owner.email,
      phone: owner.phone,
      role: owner.role,
      companyId: company.id,
      company: { name: company.name, logoUrl: company.logoUrl ?? null },
    }),
    ...tokens,
  };
}

/* ------------------------------------------------------------------ */
/* login                                                               */
/* ------------------------------------------------------------------ */

export async function login(
  input: LoginInput,
  ipAddress?: string,
): Promise<AuthResponse> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { company: { select: { name: true, logoUrl: true } } },
  });
  if (!user) throw ApiError.unauthorized('Invalid email or password');

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized('Invalid email or password');

  if (!user.isActive) throw ApiError.forbidden('Account is deactivated');

  const payload = { sub: user.id, companyId: user.companyId, role: user.role };
  const tokens = issueTokens(payload);

  await recordAudit({
    companyId: user.companyId,
    userId: user.id,
    action: 'LOGIN',
    entityType: 'user',
    entityId: user.id,
    ipAddress,
  });

  return {
    user: await toPublicUser(user),
    ...tokens,
  };
}

/* ------------------------------------------------------------------ */
/* refresh                                                             */
/* ------------------------------------------------------------------ */

export async function refresh(refreshToken: string): Promise<AuthTokens> {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid refresh token');
  }

  if (decoded.type !== 'refresh') throw ApiError.unauthorized('Wrong token type');
  if (await isTokenBlacklisted(decoded.tid)) {
    throw ApiError.unauthorized('Refresh token revoked');
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.sub },
    select: { id: true, isActive: true, companyId: true, role: true },
  });
  if (!user || !user.isActive) throw ApiError.unauthorized('User no longer active');

  return issueTokens({ sub: user.id, companyId: user.companyId, role: user.role });
}

/* ------------------------------------------------------------------ */
/* logout                                                              */
/* ------------------------------------------------------------------ */

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  try {
    const decoded = verifyRefreshToken(refreshToken);
    const ttl = getTokenTtlSeconds(refreshToken) || 7 * 24 * 60 * 60;
    await blacklistToken(decoded.tid, ttl);
  } catch {
    // Invalid token — nothing to blacklist.
  }
}

/* ------------------------------------------------------------------ */
/* me                                                                  */
/* ------------------------------------------------------------------ */

export async function me(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { company: { select: { name: true, logoUrl: true } } },
  });
  if (!user) throw ApiError.notFound('User not found');
  return toPublicUser(user);
}