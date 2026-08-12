/**
 * BuildFlow - Customer price list service (INVENTORY_HORIZONTAL_PLATFORM Phase 9.1).
 *
 * Per-customer (or company-default) rate overrides for resources. Effective-rate
 * resolution order: customer override > company default > `Resource.rate`.
 * Used when creating SO lines, issue draft-invoice lines and manual invoice lines.
 */
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import type { CustomerPriceInput } from '@buildflow/shared';

function toNum(d: { toNumber(): number } | null | undefined): number {
  return d ? Number(d) : 0;
}

export interface PriceListRow {
  id: string;
  customerId: string | null;
  customerName: string | null;
  resourceId: string;
  resourceName: string;
  unit: string;
  rate: number;
  /** 'CUSTOMER' = per-customer override; 'DEFAULT' = company-wide price. */
  scope: 'CUSTOMER' | 'DEFAULT';
}

async function assertCustomer(companyId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId },
    select: { id: true },
  });
  if (!customer) throw ApiError.notFound('Customer not found');
}

export async function upsertCustomerPrice(companyId: string, input: CustomerPriceInput) {
  if (input.customerId) await assertCustomer(companyId, input.customerId);
  const resource = await prisma.resource.findFirst({
    where: { id: input.resourceId, companyId },
    select: { id: true },
  });
  if (!resource) throw ApiError.notFound('Resource not found');

  const existing = await prisma.customerPrice.findFirst({
    where: { companyId, customerId: input.customerId ?? null, resourceId: input.resourceId },
    select: { id: true },
  });
  if (existing) {
    return prisma.customerPrice.update({
      where: { id: existing.id },
      data: { rate: input.rate },
      include: { resource: { select: { name: true, unit: true } } },
    });
  }
  return prisma.customerPrice.create({
    data: {
      companyId,
      customerId: input.customerId ?? null,
      resourceId: input.resourceId,
      rate: input.rate,
    },
    include: { resource: { select: { name: true, unit: true } } },
  });
}

export async function deleteCustomerPrice(companyId: string, id: string) {
  const deleted = await prisma.customerPrice.deleteMany({ where: { id, companyId } });
  if (deleted.count === 0) throw ApiError.notFound('Price not found');
  return { deleted: deleted.count };
}

export async function listCustomerPrices(companyId: string, customerId?: string): Promise<PriceListRow[]> {
  const rows = await prisma.customerPrice.findMany({
    where: {
      companyId,
      ...(customerId ? { customerId } : {}),
    },
    include: {
      resource: { select: { name: true, unit: true } },
      customer: { select: { name: true } },
    },
    orderBy: [{ resource: { name: 'asc' } }],
  });
  return rows.map((r) => ({
    id: r.id,
    customerId: r.customerId,
    customerName: r.customer?.name ?? null,
    resourceId: r.resourceId,
    resourceName: r.resource.name,
    unit: r.resource.unit,
    rate: toNum(r.rate),
    scope: r.customerId ? 'CUSTOMER' : 'DEFAULT',
  }));
}

/** Effective rates for many resources at once (customer override → default → catalog). */
export async function resolveEffectiveRates(
  companyId: string,
  customerId: string | null,
  resourceIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (resourceIds.length === 0) return map;

  const [overrides, resources] = await Promise.all([
    prisma.customerPrice.findMany({
      where: {
        companyId,
        resourceId: { in: resourceIds },
        ...(customerId
          ? { OR: [{ customerId }, { customerId: null }] }
          : { customerId: null }),
      },
      select: { customerId: true, resourceId: true, rate: true },
    }),
    prisma.resource.findMany({
      where: { id: { in: resourceIds }, companyId },
      select: { id: true, rate: true },
    }),
  ]);

  const byResource = new Map<string, { customerRate?: number; defaultRate?: number }>();
  for (const o of overrides) {
    const entry = byResource.get(o.resourceId) ?? {};
    if (o.customerId) entry.customerRate = Number(o.rate);
    else entry.defaultRate = Number(o.rate);
    byResource.set(o.resourceId, entry);
  }
  for (const r of resources) {
    const entry = byResource.get(r.id);
    const rate = entry?.customerRate ?? entry?.defaultRate ?? Number(r.rate ?? 0);
    map.set(r.id, rate);
  }
  return map;
}

/** Single-resource effective rate (kept for small lookups). */
export async function resolveEffectiveRate(
  companyId: string,
  customerId: string | null,
  resourceId: string,
): Promise<number> {
  return (await resolveEffectiveRates(companyId, customerId, [resourceId])).get(resourceId) ?? 0;
}
