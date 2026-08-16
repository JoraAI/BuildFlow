/**
 * BuildFlow - Auth service (business logic).
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
import { Role, INVENTORY_DEFAULT_PROJECT, InventoryBusinessProfile } from '@buildflow/shared';
import { SubscriptionPlan } from '@prisma/client';
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
    permissions: string[]; // resolved permissions for this role
    // INVENTORY_PRODUCT: product mode + modules surfaced to the app shell
    productMode: 'construction' | 'inventory';
    defaultProjectId: string | null;
    enabledModules: string[];
    subscriptionPlan: string;
    // INVENTORY_HORIZONTAL_PLATFORM (Phase 0): null on construction plans.
    inventoryProfile: InventoryBusinessProfile | null;
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
    company: {
      name: string;
      logoUrl: string | null;
      subscriptionPlan: string;
      defaultProjectId: string | null;
      inventoryProfile: InventoryBusinessProfile | null;
      inventoryVertical: string | null;
    };
  },
) {
  const { resolveLogoDisplayUrl } = await import('./settings.service');
  const { getRolePermissions } = await import('../lib/permissions');
  const [companyLogoUrl, permissions] = await Promise.all([
    resolveLogoDisplayUrl(user.companyId, user.company.logoUrl),
    getRolePermissions(user.companyId, user.role),
  ]);
  const { getProductMode, PLAN_MODULES } = await import('@buildflow/shared');
  const productMode = getProductMode(user.company.subscriptionPlan);
  const planKey = user.company.subscriptionPlan as keyof typeof PLAN_MODULES;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    companyId: user.companyId,
    companyName: user.company.name,
    companyLogoUrl,
    permissions,
    productMode,
    defaultProjectId: user.company.defaultProjectId,
    enabledModules: [...(PLAN_MODULES[planKey] ?? PLAN_MODULES.STARTER)],
    subscriptionPlan: user.company.subscriptionPlan,
    // Hidden (null) for construction; inventory tenants get their profile.
    inventoryProfile:
      productMode === 'inventory'
        ? (user.company.inventoryProfile ?? InventoryBusinessProfile.GENERAL)
        : null,
    // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.2): vertical on the auth user
    // so mobile can gate batch/expiry surfaces without an extra settings call.
    inventoryVertical:
      productMode === 'inventory' ? (user.company.inventoryVertical ?? null) : null,
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

  // INVENTORY_PRODUCT: dedicated inventory signup path creates an INVENTORY
  // company (no construction modules) with a hidden default STORE project.
  const isInventory = input.product === 'inventory';

  const passwordHash = await hashPassword(input.password);

  const company = await prisma.company.create({
    data: {
      name: input.companyName,
      gstin: input.gstin || '',
      pan: input.pan || '',
      address: input.address || null,
      state: input.state,
      ...(isInventory ? { subscriptionPlan: SubscriptionPlan.INVENTORY } : {}),
    },
  });

  await initializeTrial(
    company.id,
    isInventory ? SubscriptionPlan.INVENTORY : SubscriptionPlan.STARTER,
  );

  const owner = await prisma.user.create({
    data: {
      companyId: company.id,
      name: input.ownerName,
      email: input.ownerEmail,
      passwordHash,
      role: Role.OWNER,
    },
  });

  // INVENTORY_PRODUCT: auto-create the single default store project + set FK.
  let defaultProjectId: string | null = null;
  if (isInventory) {
    const store = await prisma.project.create({
      data: {
        companyId: company.id,
        name: INVENTORY_DEFAULT_PROJECT.name,
        code: INVENTORY_DEFAULT_PROJECT.code,
        type: 'MINI',
        status: 'IN_PROGRESS',
        clientName: input.companyName,
        budget: 0,
        createdBy: owner.id,
      },
    });
    await prisma.company.update({
      where: { id: company.id },
      data: { defaultProjectId: store.id },
    });
    defaultProjectId = store.id;
  }

  const payload = { sub: owner.id, companyId: company.id, role: Role.OWNER };
  const tokens = issueTokens(payload);

  await recordAudit({
    companyId: company.id,
    userId: owner.id,
    action: 'CREATE',
    entityType: 'company',
    entityId: company.id,
    newValue: { name: company.name, product: input.product },
    ipAddress,
  });

  void notifyNewTrialSignup(company.id, company.name, owner.email);

  const publicUser = await toPublicUser({
    id: owner.id,
    name: owner.name,
    email: owner.email,
    phone: owner.phone,
    role: owner.role,
    companyId: company.id,
    company: {
      name: company.name,
      logoUrl: company.logoUrl ?? null,
      subscriptionPlan: isInventory ? SubscriptionPlan.INVENTORY : SubscriptionPlan.STARTER,
      defaultProjectId,
      inventoryProfile: isInventory
        ? (company.inventoryProfile ?? InventoryBusinessProfile.GENERAL)
        : null,
      inventoryVertical: isInventory ? (company.inventoryVertical ?? null) : null,
    },
  });

  return {
    user: publicUser,
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
    include: {
      company: {
        select: {
          name: true,
          logoUrl: true,
          subscriptionPlan: true,
          defaultProjectId: true,
          inventoryProfile: true,
          inventoryVertical: true,
        },
      },
    },
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
    // Invalid token - nothing to blacklist.
  }
}

/* ------------------------------------------------------------------ */
/* me                                                                  */
/* ------------------------------------------------------------------ */

export async function me(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      company: {
        select: {
          name: true,
          logoUrl: true,
          subscriptionPlan: true,
          defaultProjectId: true,
          inventoryProfile: true,
          inventoryVertical: true,
        },
      },
    },
  });
  if (!user) throw ApiError.notFound('User not found');
  return toPublicUser(user);
}