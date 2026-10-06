/**
 * Ice cream B2B buyer app - auth, catalog, place order → manufacturer SalesOrder.
 *
 * Join flow: Owner creates a time-limited code → buyer claims once → later OTP login.
 * Catalog: only items the manufacturer marked b2bPublished.
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
    { expiresIn: '7d' },
  );
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

/** Look up an unused invite by code — returns owner-prefilled party details. */
export async function previewBuyerInvite(code: string) {
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
    },
  });
  if (!invite) throw ApiError.notFound('Invalid invite code');
  if (invite.acceptedAt) throw ApiError.badRequest('This invite code was already used. Sign in with OTP instead.');
  if (invite.expiresAt < new Date()) {
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
  };
}

/**
 * Buyer enters join code on first open. Creates BuyerUser and returns session.
 * Details default to what the owner prefilled; subsequent logins use email + OTP.
 */
export async function claimBuyerInvite(input: {
  code: string;
  email?: string;
  name?: string;
  phone?: string | null;
}) {
  const codeHash = hashInviteToken(normalizeCode(input.code));
  const invite = await prisma.buyerInvite.findUnique({
    where: { codeHash },
    include: {
      customer: true,
      company: { select: { id: true, name: true } },
    },
  });
  if (!invite) throw ApiError.notFound('Invalid invite code');
  if (invite.acceptedAt) throw ApiError.badRequest('This invite code was already used');
  if (invite.expiresAt < new Date()) {
    throw ApiError.badRequest('Invite code has expired. Ask the manufacturer to regenerate it.');
  }

  await assertInventoryFeature(invite.companyId, 'b2b_buyer_app');

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
    throw ApiError.conflict('A buyer with this email already exists for this manufacturer. Sign in with OTP instead.');
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
  return prisma.resource.update({
    where: { id: resourceId },
    data: { b2bPublished: published },
    select: { id: true, name: true, sku: true, b2bPublished: true, rate: true, unit: true },
  });
}

export async function sendBuyerOtp(email: string, companyId?: string) {
  const normalized = email.trim().toLowerCase();
  const buyer = await prisma.buyerUser.findFirst({
    where: {
      email: normalized,
      isActive: true,
      ...(companyId ? { companyId } : {}),
    },
  });
  if (!buyer) throw ApiError.notFound('Buyer account not found. Ask the manufacturer to invite you.');
  await assertInventoryFeature(buyer.companyId, 'b2b_buyer_app');
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

export async function loginBuyer(email: string, otp: string, companyId?: string) {
  const normalized = email.trim().toLowerCase();
  const buyer = await prisma.buyerUser.findFirst({
    where: {
      email: normalized,
      isActive: true,
      ...(companyId ? { companyId } : {}),
    },
  });
  if (!buyer) throw ApiError.unauthorized('Invalid buyer credentials');
  await assertInventoryFeature(buyer.companyId, 'b2b_buyer_app');
  await consumeOtp({
    purpose: 'login',
    key: `buyer:${buyer.id}`,
    code: otp,
    expectedDestination: buyer.email,
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
export async function getBuyerCatalog(companyId: string) {
  await assertInventoryFeature(companyId, 'b2b_buyer_app');
  return prisma.resource.findMany({
    where: {
      companyId,
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
        rate: l.rate ?? 0,
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
