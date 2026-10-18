/**
 * Ice cream B2B buyer app - auth, catalog, place order → manufacturer SalesOrder.
 *
 * Join / sign-in: manufacturer invite code only (no email/OTP required for buyers).
 * The same code can be re-entered later to restore a session.
 * Catalog: only items the manufacturer marked b2bPublished.
 * Google Play: env BUYER_PLAY_REVIEW_CODE (default PLAYREVIEW) is a reusable demo code.
 */
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { env } from '../config/env';
import { assertInventoryFeature } from './module-gate.service';
import { createSalesOrder } from './sales-order.service';
import { issueOtp, consumeOtp } from './otp.service';
import { notifyMany } from './notification.service';
import { logger } from '../config/logger';
import { hashInviteToken } from '../utils/invite-token';
import { resolveDetailedRates } from './price-list.service';
import { cacheKeys, hashQuery, invalidateCache, invalidatePattern } from '../utils/cache';
import { resolveResourceImageUrl } from './resource.service';

const BUYER_JWT_TYPE = 'buyer_access';
const DEFAULT_INVITE_HOURS = 48;
/** Ambiguity-safe alphabet for short join codes. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface BuyerTokenPayload {
  sub: string;
  companyId: string;
  customerId: string;
  type: typeof BUYER_JWT_TYPE;
}

function generateJoinCode(): { code: string; codeHash: string } {
  const bytes = crypto.randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return { code, codeHash: hashInviteToken(code.toUpperCase()) };
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/[\s-]/g, '');
}

function issueBuyerAccessToken(buyer: {
  id: string;
  companyId: string;
  customerId: string;
}): string {
  return jwt.sign(
    {
      sub: buyer.id,
      companyId: buyer.companyId,
      customerId: buyer.customerId,
      type: BUYER_JWT_TYPE,
    } satisfies BuyerTokenPayload,
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.BUYER_JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
  );
}

function playReviewCodeNormalized(): string | null {
  const raw = env.BUYER_PLAY_REVIEW_CODE?.trim();
  if (!raw) return null;
  return normalizeCode(raw);
}

function isPlayReviewCode(code: string): boolean {
  const review = playReviewCodeNormalized();
  return Boolean(review && normalizeCode(code) === review);
}

/** Resolve manufacturer catalog for Google Play reviewers. */
async function resolvePlayReviewCompanyId(): Promise<string> {
  if (env.BUYER_PLAY_REVIEW_COMPANY_ID) {
    const pinned = await prisma.company.findFirst({
      where: { id: env.BUYER_PLAY_REVIEW_COMPANY_ID },
      select: { id: true },
    });
    if (!pinned) throw ApiError.badRequest('Play review company is not configured correctly.');
    return pinned.id;
  }

  const byOwner = await prisma.user.findFirst({
    where: { email: 'owner@frostycups.com', isActive: true },
    select: { companyId: true },
  });
  if (byOwner?.companyId) return byOwner.companyId;

  const ice = await prisma.company.findFirst({
    where: { inventoryVertical: 'ICE_CREAM' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (ice) return ice.id;

  throw ApiError.badRequest(
    'Play review catalog unavailable. Seed an ICE_CREAM manufacturer or set BUYER_PLAY_REVIEW_COMPANY_ID.',
  );
}

/** Reusable Google Play reviewer session (hard-coded invite code). */
async function sessionForPlayReviewCode() {
  const companyId = await resolvePlayReviewCompanyId();
  await assertInventoryFeature(companyId, 'b2b_buyer_app');

  const reviewEmail = 'play-reviewer@jora.trade';
  let customer = await prisma.customer.findFirst({
    where: { companyId, email: reviewEmail, isActive: true },
  });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        companyId,
        name: 'Google Play Reviewer',
        businessName: 'Play Store Review',
        email: reviewEmail,
        phone: null,
        isActive: true,
      },
    });
  }

  let buyer = await prisma.buyerUser.findUnique({
    where: { companyId_email: { companyId, email: reviewEmail } },
  });
  if (!buyer) {
    buyer = await prisma.buyerUser.create({
      data: {
        companyId,
        customerId: customer.id,
        email: reviewEmail,
        name: 'Google Play Reviewer',
        phone: null,
        isActive: true,
        lastLoginAt: new Date(),
      },
    });
  } else if (!buyer.isActive) {
    buyer = await prisma.buyerUser.update({
      where: { id: buyer.id },
      data: { isActive: true, lastLoginAt: new Date(), customerId: customer.id },
    });
  } else {
    await prisma.buyerUser.update({
      where: { id: buyer.id },
      data: { lastLoginAt: new Date() },
    });
  }

  return serializeBuyerSession(buyer.id);
}

async function previewForPlayReviewCode() {
  const companyId = await resolvePlayReviewCompanyId();
  await assertInventoryFeature(companyId, 'b2b_buyer_app');
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { name: true },
  });
  return {
    companyName: company.name,
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    name: 'Google Play Reviewer',
    email: 'play-reviewer@jora.trade',
    phone: null as string | null,
    customer: {
      id: 'play-review',
      name: 'Google Play Reviewer',
      businessName: 'Play Store Review',
      email: 'play-reviewer@jora.trade',
      phone: null,
      billingAddress: null,
      shippingAddress: null,
      gstin: null,
    },
    playReview: true as const,
  };
}

async function serializeBuyerSession(buyerId: string) {
  const buyer = await prisma.buyerUser.findUniqueOrThrow({
    where: { id: buyerId },
    include: {
      customer: { select: { id: true, name: true, businessName: true } },
      company: { select: { id: true, name: true } },
    },
  });
  return {
    accessToken: issueBuyerAccessToken(buyer),
    buyer: {
      id: buyer.id,
      email: buyer.email,
      name: buyer.name,
      phone: buyer.phone,
      companyId: buyer.companyId,
      companyName: buyer.company.name,
      customerId: buyer.customerId,
      customerName: buyer.customer.businessName || buyer.customer.name,
    },
  };
}

/**
 * Owner creates (or regenerates) a short join code for a customer party.
 * Does not create BuyerUser until the customer claims the code.
 */
export async function inviteBuyer(
  companyId: string,
  invitedById: string | null,
  input: {
    customerId: string;
    email: string;
    name?: string | null;
    phone?: string | null;
    expiresInHours?: number;
  },
) {
  await assertInventoryFeature(companyId, 'b2b_buyer_app');
  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, companyId, isActive: true },
  });
  if (!customer) throw ApiError.notFound('Customer not found');

  const email = (input.email?.trim() || customer.email?.trim() || '').toLowerCase();
  if (!email) {
    throw ApiError.badRequest('Email is required on the invite so the customer can join with the code.');
  }
  const name = input.name?.trim() || customer.name;
  const phone = input.phone?.trim() || customer.phone || null;
  const hours = input.expiresInHours ?? DEFAULT_INVITE_HOURS;

  // Invalidate unused pending invites for this customer.
  await prisma.buyerInvite.updateMany({
    where: {
      companyId,
      customerId: customer.id,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { expiresAt: new Date() },
  });

  const { code, codeHash } = generateJoinCode();
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

  const invite = await prisma.buyerInvite.create({
    data: {
      companyId,
      customerId: customer.id,
      email,
      name,
      phone,
      codeHash,
      invitedById,
      expiresAt,
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          businessName: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  return {
    inviteId: invite.id,
    code,
    expiresAt: invite.expiresAt,
    customer: invite.customer,
    email: invite.email,
    name: invite.name,
    phone: invite.phone,
  };
}

export async function regenerateBuyerInvite(
  companyId: string,
  inviteId: string,
  invitedById: string | null,
  input?: { expiresInHours?: number },
) {
  await assertInventoryFeature(companyId, 'b2b_buyer_app');
  const existing = await prisma.buyerInvite.findFirst({
    where: { id: inviteId, companyId },
  });
  if (!existing) throw ApiError.notFound('Invite not found');
  if (existing.acceptedAt) {
    throw ApiError.badRequest('Invite already accepted. Revoke the buyer and create a new invite if needed.');
  }

  // Expire the old invite, then issue a fresh code for the same customer/prefill.
  await prisma.buyerInvite.update({
    where: { id: existing.id },
    data: { expiresAt: new Date() },
  });

  const email = existing.email || undefined;
  if (!email) {
    throw ApiError.badRequest('Invite is missing an email. Create a new invite with an email address.');
  }
  return inviteBuyer(companyId, invitedById, {
    customerId: existing.customerId,
    email,
    name: existing.name,
    phone: existing.phone,
    expiresInHours: input?.expiresInHours,
  });
}

export async function listBuyerInvites(companyId: string) {
  await assertInventoryFeature(companyId, 'b2b_buyer_app');
  return prisma.buyerInvite.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    include: {
      customer: { select: { id: true, name: true, businessName: true, phone: true, email: true } },
      buyerUser: { select: { id: true, email: true, isActive: true, lastLoginAt: true } },
    },
  });
}

export async function listBuyers(companyId: string) {
  await assertInventoryFeature(companyId, 'b2b_buyer_app');
  return prisma.buyerUser.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    include: { customer: { select: { id: true, name: true, businessName: true, phone: true, email: true } } },
  });
}

export async function revokeBuyerAccess(companyId: string, buyerUserId: string) {
  await assertInventoryFeature(companyId, 'b2b_buyer_app');
  const buyer = await prisma.buyerUser.findFirst({
    where: { id: buyerUserId, companyId },
  });
  if (!buyer) throw ApiError.notFound('Buyer not found');

  // Expire any unused invites for this customer too.
  await prisma.buyerInvite.updateMany({
    where: {
      companyId,
      customerId: buyer.customerId,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { expiresAt: new Date() },
  });

  return prisma.buyerUser.update({
    where: { id: buyer.id },
    data: { isActive: false },
    include: { customer: { select: { id: true, name: true, businessName: true } } },
  });
}

/** Look up an invite by code — returns owner-prefilled party details (or Play review demo). */
export async function previewBuyerInvite(code: string) {
  if (isPlayReviewCode(code)) {
    return previewForPlayReviewCode();
  }

  const codeHash = hashInviteToken(normalizeCode(code));
  const invite = await prisma.buyerInvite.findUnique({
    where: { codeHash },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          businessName: true,
          email: true,
          phone: true,
          billingAddress: true,
          shippingAddress: true,
          gstin: true,
        },
      },
      company: { select: { id: true, name: true } },
      buyerUser: { select: { id: true, isActive: true } },
    },
  });
  if (!invite) throw ApiError.notFound('Invalid invite code');
  if (invite.expiresAt < new Date() && !invite.acceptedAt) {
    throw ApiError.badRequest('Invite code has expired. Ask the manufacturer to regenerate it.');
  }
  await assertInventoryFeature(invite.companyId, 'b2b_buyer_app');

  return {
    companyName: invite.company.name,
    expiresAt: invite.expiresAt,
    name: invite.name || invite.customer.name,
    email: invite.email || invite.customer.email,
    phone: invite.phone || invite.customer.phone,
    customer: invite.customer,
    /** Already joined — Confirm re-opens their catalog session (no OTP). */
    alreadyJoined: Boolean(invite.acceptedAt && invite.buyerUser?.isActive),
  };
}

/**
 * Buyer enters join code. First use creates BuyerUser; later use of the same code
 * restores the session (no email/phone OTP required).
 */
export async function claimBuyerInvite(input: {
  code: string;
  email?: string;
  name?: string;
  phone?: string | null;
}) {
  if (isPlayReviewCode(input.code)) {
    return sessionForPlayReviewCode();
  }

  const codeHash = hashInviteToken(normalizeCode(input.code));
  const invite = await prisma.buyerInvite.findUnique({
    where: { codeHash },
    include: {
      customer: true,
      company: { select: { id: true, name: true } },
      buyerUser: true,
    },
  });
  if (!invite) throw ApiError.notFound('Invalid invite code');

  await assertInventoryFeature(invite.companyId, 'b2b_buyer_app');

  // Re-entry with the same invite code → restore session (invite-only login).
  if (invite.acceptedAt && invite.buyerUserId) {
    const existing = invite.buyerUser;
    if (!existing || !existing.isActive) {
      throw ApiError.forbidden('Buyer access was revoked. Ask the manufacturer for a new invite.');
    }
    await prisma.buyerUser.update({
      where: { id: existing.id },
      data: { lastLoginAt: new Date() },
    });
    return serializeBuyerSession(existing.id);
  }

  if (invite.expiresAt < new Date()) {
    throw ApiError.badRequest('Invite code has expired. Ask the manufacturer to regenerate it.');
  }

  const email = (
    input.email?.trim() ||
    invite.email ||
    invite.customer.email ||
    ''
  ).toLowerCase();
  if (!email) {
    throw ApiError.badRequest('Invite is missing an email. Ask the manufacturer to regenerate with an email.');
  }
  const name = input.name?.trim() || invite.name || invite.customer.name;
  const phone = input.phone?.trim() || invite.phone || invite.customer.phone || null;

  const conflict = await prisma.buyerUser.findUnique({
    where: { companyId_email: { companyId: invite.companyId, email } },
  });
  if (conflict && conflict.isActive) {
    // Same email already a buyer — treat code claim as re-login for that account.
    await prisma.buyerInvite.update({
      where: { id: invite.id },
      data: {
        acceptedAt: new Date(),
        buyerUserId: conflict.id,
        email,
        name,
        phone,
      },
    });
    await prisma.buyerUser.update({
      where: { id: conflict.id },
      data: { lastLoginAt: new Date(), customerId: invite.customerId },
    });
    return serializeBuyerSession(conflict.id);
  }

  const buyer = await prisma.$transaction(async (tx) => {
    let user;
    if (conflict && !conflict.isActive) {
      user = await tx.buyerUser.update({
        where: { id: conflict.id },
        data: {
          customerId: invite.customerId,
          name,
          phone,
          isActive: true,
          lastLoginAt: new Date(),
        },
      });
    } else {
      user = await tx.buyerUser.create({
        data: {
          companyId: invite.companyId,
          customerId: invite.customerId,
          email,
          name,
          phone,
          isActive: true,
          lastLoginAt: new Date(),
        },
      });
    }

    await tx.buyerInvite.update({
      where: { id: invite.id },
      data: {
        acceptedAt: new Date(),
        buyerUserId: user.id,
        email,
        name,
        phone,
      },
    });

    // Keep party email/name in sync with claim when owner left them blank.
    await tx.customer.update({
      where: { id: invite.customerId },
      data: {
        email: invite.customer.email || email,
        phone: invite.customer.phone || phone,
      },
    });

    return user;
  });

  return serializeBuyerSession(buyer.id);
}

export async function setResourceB2bPublished(
  companyId: string,
  resourceId: string,
  published: boolean,
) {
  await assertInventoryFeature(companyId, 'b2b_buyer_app');
  const resource = await prisma.resource.findFirst({
    where: { id: resourceId, companyId, isDeleted: false },
  });
  if (!resource) throw ApiError.notFound('Item not found');

  // ICE_CREAM: buyer catalog needs role sell prices. Seeded FG often only has `rate`
  // — default missing distributor/customer rates from that sell price so Publish B2B
  // is not a silent failure after the busy overlay.
  const data: {
    b2bPublished: boolean;
    distributorRate?: typeof resource.rate;
    customerRate?: typeof resource.rate;
  } = { b2bPublished: published };

  if (published) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { inventoryVertical: true },
    });
    if (company?.inventoryVertical === 'ICE_CREAM') {
      if (resource.distributorRate == null) data.distributorRate = resource.rate;
      if (resource.customerRate == null) data.customerRate = resource.rate;
    }
  }

  const updated = await prisma.resource.update({
    where: { id: resourceId },
    data,
    select: {
      id: true,
      name: true,
      sku: true,
      b2bPublished: true,
      rate: true,
      unit: true,
      distributorRate: true,
      customerRate: true,
    },
  });

  // listResources caches page-1 for 1h; clear pattern + common exact list keys.
  await invalidatePattern(`cache:${companyId}:resources:*`);
  await invalidateCache(
    cacheKeys.resourcesList(
      companyId,
      hashQuery({ type: undefined, active: undefined, page: 1, limit: 200 }),
    ),
    cacheKeys.resourcesList(
      companyId,
      hashQuery({ type: undefined, active: undefined, page: 1, limit: 50 }),
    ),
    cacheKeys.resource(companyId, resourceId),
  );
  return updated;
}

async function findActiveBuyerByIdentifier(identifierRaw: string, companyId?: string) {
  const identifier = identifierRaw.trim();
  const companyFilter = companyId ? { companyId } : {};

  if (identifier.includes('@')) {
    return prisma.buyerUser.findFirst({
      where: {
        email: identifier.toLowerCase(),
        isActive: true,
        ...companyFilter,
      },
    });
  }

  const { normalizePhone } = await import('@buildflow/shared');
  const phone = normalizePhone(identifier);
  const digits = phone.replace(/\D/g, '');
  const variants = Array.from(
    new Set(
      [
        phone,
        digits,
        `+${digits}`,
        digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : '',
        digits.length === 10 ? `+91${digits}` : '',
      ].filter(Boolean),
    ),
  );

  return prisma.buyerUser.findFirst({
    where: {
      isActive: true,
      phone: { in: variants },
      ...companyFilter,
    },
  });
}

/**
 * Buyer OTP — SMS via MSG91/Twilio when logging in with mobile; email otherwise.
 * Same delivery stack as Construction ERP + Inventory staff login.
 */
export async function sendBuyerOtp(identifierRaw: string, companyId?: string) {
  const buyer = await findActiveBuyerByIdentifier(identifierRaw, companyId);
  if (!buyer) throw ApiError.notFound('Buyer account not found. Ask the manufacturer to invite you.');
  await assertInventoryFeature(buyer.companyId, 'b2b_buyer_app');

  const useSms = !identifierRaw.trim().includes('@') && Boolean(buyer.phone);
  if (useSms && buyer.phone) {
    const { normalizePhone } = await import('@buildflow/shared');
    const phone = normalizePhone(buyer.phone);
    return issueOtp({
      purpose: 'login',
      key: `buyer:${buyer.id}`,
      channel: 'sms',
      destination: phone,
      companyId: buyer.companyId,
      messagePrefix: 'StaffingPros: Your BuildFlow buyer login code is',
    });
  }

  return issueOtp({
    purpose: 'login',
    key: `buyer:${buyer.id}`,
    channel: 'email',
    destination: buyer.email,
    companyId: buyer.companyId,
    messagePrefix: 'StaffingPros: Your BuildFlow buyer login code is',
    emailSubject: 'Your BuildFlow buyer login code',
  });
}

export async function loginBuyer(identifierRaw: string, otp: string, companyId?: string) {
  const buyer = await findActiveBuyerByIdentifier(identifierRaw, companyId);
  if (!buyer) throw ApiError.unauthorized('Invalid buyer credentials');
  await assertInventoryFeature(buyer.companyId, 'b2b_buyer_app');

  const useSms = !identifierRaw.trim().includes('@') && Boolean(buyer.phone);
  let expectedDestination = buyer.email;
  if (useSms && buyer.phone) {
    const { normalizePhone } = await import('@buildflow/shared');
    expectedDestination = normalizePhone(buyer.phone);
  }

  await consumeOtp({
    purpose: 'login',
    key: `buyer:${buyer.id}`,
    code: otp,
    expectedDestination,
  });
  await prisma.buyerUser.update({
    where: { id: buyer.id },
    data: { lastLoginAt: new Date() },
  });
  return serializeBuyerSession(buyer.id);
}

export function verifyBuyerToken(token: string): BuyerTokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as BuyerTokenPayload;
    if (payload.type !== BUYER_JWT_TYPE) throw new Error('wrong type');
    return payload;
  } catch {
    throw ApiError.unauthorized('Invalid or expired buyer session');
  }
}

/** Catalog = manufacturer item master rows marked for B2B (owner published). */
export async function getBuyerCatalog(buyer: BuyerTokenPayload) {
  await assertInventoryFeature(buyer.companyId, 'b2b_buyer_app');
  const rows = await prisma.resource.findMany({
    where: {
      companyId: buyer.companyId,
      b2bPublished: true,
      isActive: true,
      isDeleted: false,
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      sku: true,
      unit: true,
      rate: true,
      mrp: true,
      category: true,
      imageUrl: true,
    },
  });
  const priced = await resolveDetailedRates(
    buyer.companyId,
    buyer.customerId,
    rows.map((r) => r.id),
  );
  return Promise.all(
    rows.map(async (r) => {
      const p = priced.get(r.id);
      const imageUrl = await resolveResourceImageUrl(buyer.companyId, r.imageUrl);
      return {
        ...r,
        imageUrl,
        mrp: p?.mrp ?? (r.mrp != null ? Number(r.mrp) : null),
        listRate: p?.listRate ?? Number(r.rate ?? 0),
        discountPct: p?.discountPct ?? 0,
        rate: p?.rate ?? Number(r.rate ?? 0),
      };
    }),
  );
}

/** Other manufacturer accounts linked to the same buyer email/phone. */
export async function listBuyerMemberships(buyer: BuyerTokenPayload) {
  const me = await prisma.buyerUser.findFirst({
    where: { id: buyer.sub, isActive: true },
  });
  if (!me) throw ApiError.unauthorized('Buyer account inactive');

  const or: Array<{ email: string } | { phone: string }> = [];
  if (me.email) or.push({ email: me.email.toLowerCase() });
  if (me.phone) or.push({ phone: me.phone });

  const rows = await prisma.buyerUser.findMany({
    where: or.length > 0 ? { isActive: true, OR: or } : { id: me.id, isActive: true },
    include: {
      company: { select: { id: true, name: true, inventoryVertical: true } },
      customer: { select: { name: true, businessName: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return rows.map((r) => ({
    buyerUserId: r.id,
    companyId: r.companyId,
    companyName: r.company.name,
    inventoryVertical: r.company.inventoryVertical,
    customerName: r.customer.businessName || r.customer.name,
    isCurrent: r.id === buyer.sub,
  }));
}

export async function switchBuyerMembership(
  buyer: BuyerTokenPayload,
  targetBuyerUserId: string,
) {
  const me = await prisma.buyerUser.findFirst({
    where: { id: buyer.sub, isActive: true },
  });
  if (!me) throw ApiError.unauthorized('Buyer account inactive');

  const target = await prisma.buyerUser.findFirst({
    where: { id: targetBuyerUserId, isActive: true },
    include: { company: { select: { id: true } } },
  });
  if (!target) throw ApiError.notFound('Manufacturer account not found');

  const sameEmail =
    Boolean(me.email) &&
    Boolean(target.email) &&
    me.email.toLowerCase() === target.email.toLowerCase();
  const samePhone = Boolean(me.phone) && Boolean(target.phone) && me.phone === target.phone;
  if (!sameEmail && !samePhone) {
    throw ApiError.forbidden('That manufacturer is not linked to this buyer profile');
  }

  await assertInventoryFeature(target.companyId, 'b2b_buyer_app');
  await prisma.buyerUser.update({
    where: { id: target.id },
    data: { lastLoginAt: new Date() },
  });
  return serializeBuyerSession(target.id);
}

export async function getBuyerProfile(buyer: BuyerTokenPayload) {
  const row = await prisma.buyerUser.findFirst({
    where: { id: buyer.sub, companyId: buyer.companyId, isActive: true },
    include: {
      customer: true,
      company: { select: { id: true, name: true } },
    },
  });
  if (!row) throw ApiError.unauthorized('Buyer account inactive');
  return {
    buyer: {
      id: row.id,
      email: row.email,
      name: row.name,
      phone: row.phone,
      companyId: row.companyId,
      companyName: row.company.name,
      customerId: row.customerId,
    },
    customer: {
      id: row.customer.id,
      name: row.customer.name,
      businessName: row.customer.businessName,
      gstin: row.customer.gstin,
      pan: row.customer.pan,
      phone: row.customer.phone,
      email: row.customer.email,
      billingAddress: row.customer.billingAddress,
      shippingAddress: row.customer.shippingAddress,
      paymentTerms: row.customer.paymentTerms,
      buyerRole: row.customer.buyerRole,
      tradeDiscountPct:
        row.customer.tradeDiscountPct != null ? Number(row.customer.tradeDiscountPct) : null,
    },
  };
}

export async function updateBuyerProfile(
  buyer: BuyerTokenPayload,
  input: {
    name?: string;
    businessName?: string | null;
    gstin?: string | null;
    pan?: string | null;
    phone?: string | null;
    email?: string | null;
    billingAddress?: string | null;
    shippingAddress?: string | null;
    contactName?: string | null;
  },
) {
  const row = await prisma.buyerUser.findFirst({
    where: { id: buyer.sub, companyId: buyer.companyId, isActive: true },
  });
  if (!row) throw ApiError.unauthorized('Buyer account inactive');

  const customerEmail = input.email?.trim().toLowerCase() || undefined;
  const buyerName = input.contactName?.trim() || input.name?.trim();

  if (customerEmail && customerEmail !== row.email) {
    const taken = await prisma.buyerUser.findUnique({
      where: { companyId_email: { companyId: buyer.companyId, email: customerEmail } },
    });
    if (taken && taken.id !== row.id) {
      throw ApiError.conflict('Another buyer already uses this email');
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.customer.update({
      where: { id: row.customerId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.businessName !== undefined ? { businessName: input.businessName } : {}),
        ...(input.gstin !== undefined ? { gstin: input.gstin } : {}),
        ...(input.pan !== undefined ? { pan: input.pan } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(customerEmail !== undefined ? { email: customerEmail } : {}),
        ...(input.billingAddress !== undefined ? { billingAddress: input.billingAddress } : {}),
        ...(input.shippingAddress !== undefined ? { shippingAddress: input.shippingAddress } : {}),
      },
    });

    await tx.buyerUser.update({
      where: { id: row.id },
      data: {
        ...(buyerName ? { name: buyerName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        // Login email stays on BuyerUser; allow update if provided and unique.
        ...(customerEmail
          ? {
              email: customerEmail,
            }
          : {}),
      },
    });
  });

  return getBuyerProfile(buyer);
}

export async function placeBuyerOrder(
  buyer: BuyerTokenPayload,
  input: {
    lines: Array<{ resourceId: string; quantity: number; rate?: number }>;
    notes?: string;
    expectedDelivery?: Date;
  },
) {
  await assertInventoryFeature(buyer.companyId, 'b2b_buyer_app');
  const buyerUser = await prisma.buyerUser.findFirst({
    where: { id: buyer.sub, companyId: buyer.companyId, isActive: true },
    include: { customer: true },
  });
  if (!buyerUser) throw ApiError.unauthorized('Buyer account inactive');

  const published = await prisma.resource.findMany({
    where: {
      companyId: buyer.companyId,
      id: { in: input.lines.map((l) => l.resourceId) },
      b2bPublished: true,
      isActive: true,
      isDeleted: false,
    },
    select: { id: true, unit: true },
  });
  if (published.length !== input.lines.length) {
    throw ApiError.badRequest('One or more items are not available in the B2B catalog');
  }
  const unitById = new Map(published.map((r) => [r.id, r.unit]));
  const rates = await resolveDetailedRates(
    buyer.companyId,
    buyerUser.customerId,
    input.lines.map((l) => l.resourceId),
  );

  const order = await createSalesOrder(
    buyer.companyId,
    buyer.sub,
    'INVENTORY_MANAGER',
    {
      customerId: buyerUser.customerId,
      customerName: buyerUser.customer.name,
      orderDate: new Date(),
      expectedDelivery: input.expectedDelivery,
      notes: input.notes ?? `B2B app order from ${buyerUser.email}`,
      lines: input.lines.map((l) => ({
        resourceId: l.resourceId,
        quantity: l.quantity,
        unit: unitById.get(l.resourceId) ?? 'nos',
        rate: rates.get(l.resourceId)?.rate ?? 0,
      })),
    },
    {
      source: 'B2B_APP',
      buyerUserId: buyerUser.id,
      skipProjectAccess: true,
      initialStatus: 'CONFIRMED',
    },
  );

  try {
    const recipients = await prisma.user.findMany({
      where: {
        companyId: buyer.companyId,
        role: { in: ['OWNER', 'INVENTORY_MANAGER'] },
        isActive: true,
      },
      select: { id: true },
    });
    if (recipients.length > 0) {
      await notifyMany(
        recipients.map((r) => r.id),
        {
          companyId: buyer.companyId,
          title: `B2B order ${order.soNumber}`,
          body: `${buyerUser.customer.name} placed an order for ₹${Number(order.total).toFixed(2)}.`,
          type: 'B2B_ORDER_PLACED',
          referenceId: order.id,
        },
      );
    }
  } catch (err) {
    logger.warn('B2B order notify failed (non-fatal)', { error: String(err) });
  }

  return order;
}

export async function listBuyerOrders(buyer: BuyerTokenPayload) {
  return prisma.salesOrder.findMany({
    where: {
      companyId: buyer.companyId,
      customerId: buyer.customerId,
      source: 'B2B_APP',
    },
    orderBy: { createdAt: 'desc' },
    include: { lines: true },
  });
}

export async function getBuyerOrder(buyer: BuyerTokenPayload, id: string) {
  const order = await prisma.salesOrder.findFirst({
    where: {
      id,
      companyId: buyer.companyId,
      customerId: buyer.customerId,
      source: 'B2B_APP',
    },
    include: { lines: true },
  });
  if (!order) throw ApiError.notFound('Order not found');
  return order;
}
