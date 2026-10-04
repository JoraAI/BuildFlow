/**
 * Ice cream B2B buyer app - auth, catalog, place order → manufacturer SalesOrder.
 */
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { env } from '../config/env';
import { assertInventoryFeature } from './module-gate.service';
import { createSalesOrder } from './sales-order.service';
import { issueOtp, consumeOtp } from './otp.service';
import { notifyMany } from './notification.service';
import { logger } from '../config/logger';

const BUYER_JWT_TYPE = 'buyer_access';

export interface BuyerTokenPayload {
  sub: string;
  companyId: string;
  customerId: string;
  type: typeof BUYER_JWT_TYPE;
}

export async function inviteBuyer(
  companyId: string,
  input: { customerId: string; email: string; name?: string; phone?: string },
) {
  await assertInventoryFeature(companyId, 'b2b_buyer_app');
  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, companyId, isActive: true },
  });
  if (!customer) throw ApiError.notFound('Customer not found');

  const email = input.email.trim().toLowerCase();
  const existing = await prisma.buyerUser.findUnique({
    where: { companyId_email: { companyId, email } },
  });
  if (existing) {
    return prisma.buyerUser.update({
      where: { id: existing.id },
      data: {
        customerId: customer.id,
        name: input.name?.trim() || existing.name,
        phone: input.phone?.trim() || existing.phone,
        isActive: true,
      },
    });
  }
  return prisma.buyerUser.create({
    data: {
      companyId,
      customerId: customer.id,
      email,
      name: input.name?.trim() || customer.name,
      phone: input.phone?.trim() || customer.phone,
    },
  });
}

export async function listBuyers(companyId: string) {
  await assertInventoryFeature(companyId, 'b2b_buyer_app');
  return prisma.buyerUser.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    include: { customer: { select: { id: true, name: true, businessName: true } } },
  });
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
    messagePrefix: 'Your BuildFlow buyer login code is',
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
    include: {
      customer: { select: { id: true, name: true, businessName: true } },
      company: { select: { id: true, name: true } },
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
  const accessToken = jwt.sign(
    {
      sub: buyer.id,
      companyId: buyer.companyId,
      customerId: buyer.customerId,
      type: BUYER_JWT_TYPE,
    } satisfies BuyerTokenPayload,
    env.JWT_ACCESS_SECRET,
    { expiresIn: '7d' },
  );
  return {
    accessToken,
    buyer: {
      id: buyer.id,
      email: buyer.email,
      name: buyer.name,
      companyId: buyer.companyId,
      companyName: buyer.company.name,
      customerId: buyer.customerId,
      customerName: buyer.customer.name,
    },
  };
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
