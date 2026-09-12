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
  expiresInSeconds,
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

const ACCESS_EXPIRES_SECONDS = expiresInSeconds(env.JWT_ACCESS_EXPIRES_IN);

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

  const { normalizePhone } = await import('@buildflow/shared');
  const ownerPhone = input.ownerPhone ? normalizePhone(input.ownerPhone) : null;
  let ownerEmail = input.ownerEmail?.toLowerCase() || null;

  if (!ownerEmail && !ownerPhone) {
    throw ApiError.badRequest('Owner email or mobile number is required');
  }

  if (!ownerEmail && ownerPhone) {
    const digits = ownerPhone.replace(/\D/g, '');
    ownerEmail = `u.${digits}@phone.buildflow.local`;
  }

  if (ownerEmail) {
    const existingEmail = await prisma.user.findFirst({
      where: { email: ownerEmail, isActive: true },
      select: { id: true },
    });
    if (existingEmail) throw ApiError.conflict('Email already registered');
  }

  if (ownerPhone) {
    const digits = ownerPhone.replace(/\D/g, '');
    const variants = Array.from(
      new Set(
        [
          ownerPhone,
          digits,
          `+${digits}`,
          digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : '',
        ].filter(Boolean),
      ),
    );
    const existingPhone = await prisma.user.findFirst({
      where: { phone: { in: variants }, isActive: true },
      select: { id: true },
    });
    if (existingPhone) throw ApiError.conflict('Mobile number already registered');

    // Free inactive accounts that still hold this phone/email so signup can proceed.
    const inactive = await prisma.user.findMany({
      where: {
        isActive: false,
        OR: [
          ...(ownerEmail ? [{ email: ownerEmail }] : []),
          { phone: { in: variants } },
        ],
      },
      select: { id: true },
    });
    for (const u of inactive) {
      await prisma.user.update({
        where: { id: u.id },
        data: {
          email: `deleted.${u.id.replace(/-/g, '')}@deleted.buildflow.local`,
          phone: null,
        },
      });
    }
  } else if (ownerEmail) {
    const inactiveEmail = await prisma.user.findFirst({
      where: { email: ownerEmail, isActive: false },
      select: { id: true },
    });
    if (inactiveEmail) {
      await prisma.user.update({
        where: { id: inactiveEmail.id },
        data: {
          email: `deleted.${inactiveEmail.id.replace(/-/g, '')}@deleted.buildflow.local`,
          phone: null,
        },
      });
    }
  }

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
      email: ownerEmail!,
      phone: ownerPhone,
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
    newValue: {
      name: company.name,
      product: input.product,
      ownerContact: ownerPhone ?? ownerEmail,
    },
    ipAddress,
  });

  void notifyNewTrialSignup(company.id, company.name, ownerPhone ?? owner.email);

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
  const identifier = input.email.trim();
  const companySelect = {
    name: true,
    logoUrl: true,
    subscriptionPlan: true,
    defaultProjectId: true,
    inventoryProfile: true,
    inventoryVertical: true,
  } as const;

  const user = identifier.includes('@')
    ? await prisma.user.findUnique({
        where: { email: identifier.toLowerCase() },
        include: { company: { select: companySelect } },
      })
    : await (async () => {
        const { normalizePhone } = await import('@buildflow/shared');
        const normalized = normalizePhone(identifier);
        const digits = normalized.replace(/\D/g, '');
        const variants = Array.from(
          new Set(
            [
              normalized,
              identifier,
              digits,
              `+${digits}`,
              digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : '',
            ].filter(Boolean),
          ),
        );
        const active = await prisma.user.findFirst({
          where: { phone: { in: variants }, isActive: true },
          include: { company: { select: companySelect } },
        });
        if (active) return active;
        // Surface a clear deactivated error instead of "invalid credentials".
        return prisma.user.findFirst({
          where: { phone: { in: variants } },
          include: { company: { select: companySelect } },
          orderBy: { createdAt: 'desc' },
        });
      })();

  if (!user) throw ApiError.unauthorized('Invalid email/mobile or password');

  if (input.otp) {
    if (identifier.includes('@')) {
      throw ApiError.badRequest('OTP login is only available with a mobile number');
    }
    const { normalizePhone } = await import('@buildflow/shared');
    const phone = normalizePhone(identifier);
    const { consumeOtp } = await import('./otp.service');
    await consumeOtp({
      purpose: 'login',
      key: phone,
      code: input.otp,
      expectedPhone: phone,
    });
  } else {
    if (!input.password) throw ApiError.unauthorized('Invalid email/mobile or password');
    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) throw ApiError.unauthorized('Invalid email/mobile or password');
  }

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

export async function sendLoginOtp(phoneRaw: string): Promise<{
  sent: true;
  expiresInSec: number;
  phoneMasked: string;
  devCode?: string;
}> {
  const { normalizePhone } = await import('@buildflow/shared');
  const phone = normalizePhone(phoneRaw);
  const digits = phone.replace(/\D/g, '');
  const variants = Array.from(
    new Set(
      [
        phone,
        digits,
        `+${digits}`,
        digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : '',
      ].filter(Boolean),
    ),
  );

  const user = await prisma.user.findFirst({
    where: { phone: { in: variants }, isActive: true },
    select: { id: true, companyId: true, phone: true },
  });
  if (!user?.phone) {
    // Avoid account enumeration — still pretend success, but do not issue OTP.
    return {
      sent: true,
      expiresInSec: 600,
      phoneMasked: digits.length >= 4 ? `******${digits.slice(-4)}` : '******',
    };
  }

  const result = await (
    await import('./otp.service')
  ).issueOtp({
    purpose: 'login',
    key: phone,
    phone,
    companyId: user.companyId,
    messagePrefix: 'Your BuildFlow login code is',
  });

  return {
    ...result,
    phoneMasked: digits.length >= 4 ? `******${digits.slice(-4)}` : phone,
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