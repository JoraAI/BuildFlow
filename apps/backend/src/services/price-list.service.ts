/**
 * BuildFlow - Customer price list service (INVENTORY_HORIZONTAL_PLATFORM Phase 9.1).
 *
 * Per-customer (or company-default) rate overrides for resources. Effective-rate
 * resolution order: customer override > company default > role trade discount
 * off MRP > `Resource.rate`.
 */
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { round2 } from './gst.service';
import type { CustomerPriceInput, BuyerPartyRole } from '@buildflow/shared';

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

export interface RoleDiscountDefaults {
  distributorDiscountPct: number;
  customerDiscountPct: number;
}

const DEFAULT_DISTRIBUTOR_PCT = 20;
const DEFAULT_CUSTOMER_PCT = 10;

export function roleDiscountDefaultsFromSettings(
  settings: Record<string, unknown> | null | undefined,
): RoleDiscountDefaults {
  const dist = Number(settings?.distributorDiscountPct);
  const cust = Number(settings?.customerDiscountPct);
  return {
    distributorDiscountPct:
      Number.isFinite(dist) && dist >= 0 ? dist : DEFAULT_DISTRIBUTOR_PCT,
    customerDiscountPct: Number.isFinite(cust) && cust >= 0 ? cust : DEFAULT_CUSTOMER_PCT,
  };
}

export function resolveTradeDiscountPct(opts: {
  buyerRole: BuyerPartyRole | string | null | undefined;
  tradeDiscountPct: number | null | undefined;
  defaults: RoleDiscountDefaults;
}): number {
  if (opts.tradeDiscountPct != null && Number.isFinite(Number(opts.tradeDiscountPct))) {
    return Math.min(100, Math.max(0, Number(opts.tradeDiscountPct)));
  }
  return opts.buyerRole === 'DISTRIBUTOR'
    ? opts.defaults.distributorDiscountPct
    : opts.defaults.customerDiscountPct;
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

async function loadRolePricingContext(companyId: string, customerId: string | null) {
  const [company, customer] = await Promise.all([
    prisma.company.findFirst({
      where: { id: companyId },
      select: { reportSettings: true },
    }),
    customerId
      ? prisma.customer.findFirst({
          where: { id: customerId, companyId },
          select: { buyerRole: true, tradeDiscountPct: true },
        })
      : Promise.resolve(null),
  ]);
  const defaults = roleDiscountDefaultsFromSettings(
    (company?.reportSettings as Record<string, unknown> | null) ?? null,
  );
  const discountPct = customer
    ? resolveTradeDiscountPct({
        buyerRole: customer.buyerRole,
        tradeDiscountPct: customer.tradeDiscountPct != null ? Number(customer.tradeDiscountPct) : null,
        defaults,
      })
    : 0;
  return { defaults, discountPct, buyerRole: customer?.buyerRole ?? null };
}

export interface ResolvedCatalogRate {
  resourceId: string;
  mrp: number | null;
  listRate: number;
  discountPct: number;
  rate: number;
  source: 'CUSTOMER_PRICE' | 'DEFAULT_PRICE' | 'ROLE_SKU' | 'ROLE_MRP' | 'CATALOG';
}

/** Effective rates for many resources at once (customer override → default → role MRP → catalog). */
export async function resolveEffectiveRates(
  companyId: string,
  customerId: string | null,
  resourceIds: string[],
): Promise<Map<string, number>> {
  const detailed = await resolveDetailedRates(companyId, customerId, resourceIds);
  const map = new Map<string, number>();
  for (const [id, row] of detailed) map.set(id, row.rate);
  return map;
}

export async function resolveDetailedRates(
  companyId: string,
  customerId: string | null,
  resourceIds: string[],
): Promise<Map<string, ResolvedCatalogRate>> {
  const map = new Map<string, ResolvedCatalogRate>();
  if (resourceIds.length === 0) return map;

  const [{ discountPct, buyerRole }, overrides, resources] = await Promise.all([
    loadRolePricingContext(companyId, customerId),
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
      select: { id: true, rate: true, mrp: true, distributorRate: true, customerRate: true },
    }),
  ]);

  const byResource = new Map<string, { customerPrice?: number; defaultPrice?: number }>();
  for (const o of overrides) {
    const entry = byResource.get(o.resourceId) ?? {};
    if (o.customerId) entry.customerPrice = Number(o.rate);
    else entry.defaultPrice = Number(o.rate);
    byResource.set(o.resourceId, entry);
  }

  for (const r of resources) {
    const entry = byResource.get(r.id);
    const catalogRate = Number(r.rate ?? 0);
    const mrp = r.mrp != null ? Number(r.mrp) : null;
    const listRate = mrp != null && mrp > 0 ? mrp : catalogRate;
    const roleSkuRate =
      buyerRole === 'DISTRIBUTOR'
        ? r.distributorRate != null
          ? Number(r.distributorRate)
          : null
        : buyerRole === 'CUSTOMER'
          ? r.customerRate != null
            ? Number(r.customerRate)
            : null
          : null;

    if (entry?.customerPrice != null) {
      map.set(r.id, {
        resourceId: r.id,
        mrp,
        listRate,
        discountPct: 0,
        rate: entry.customerPrice,
        source: 'CUSTOMER_PRICE',
      });
      continue;
    }
    if (entry?.defaultPrice != null) {
      map.set(r.id, {
        resourceId: r.id,
        mrp,
        listRate,
        discountPct: 0,
        rate: entry.defaultPrice,
        source: 'DEFAULT_PRICE',
      });
      continue;
    }
    if (customerId && roleSkuRate != null && roleSkuRate >= 0) {
      map.set(r.id, {
        resourceId: r.id,
        mrp,
        listRate: roleSkuRate,
        discountPct: 0,
        rate: roleSkuRate,
        source: 'ROLE_SKU',
      });
      continue;
    }
    if (customerId && mrp != null && mrp > 0 && discountPct > 0) {
      map.set(r.id, {
        resourceId: r.id,
        mrp,
        listRate: mrp,
        discountPct,
        rate: round2(mrp * (1 - discountPct / 100)),
        source: 'ROLE_MRP',
      });
      continue;
    }
    map.set(r.id, {
      resourceId: r.id,
      mrp,
      listRate,
      discountPct: customerId ? discountPct : 0,
      rate: catalogRate,
      source: 'CATALOG',
    });
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

/**
 * Effective rates for all active catalog items for a customer (or company default).
 * Used by SO/invoice UI prefills so role SKU prices + price lists apply.
 */
export async function listEffectiveRatesForCustomer(
  companyId: string,
  customerId?: string | null,
): Promise<Array<{ resourceId: string; rate: number; source: string }>> {
  const resources = await prisma.resource.findMany({
    where: { companyId, isActive: true, isDeleted: false },
    select: { id: true },
  });
  const detailed = await resolveDetailedRates(
    companyId,
    customerId ?? null,
    resources.map((r) => r.id),
  );
  return [...detailed.values()].map((row) => ({
    resourceId: row.resourceId,
    rate: row.rate,
    source: row.source,
  }));
}
