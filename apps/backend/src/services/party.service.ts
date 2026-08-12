/**
 * BuildFlow - Party master service (INVENTORY_HORIZONTAL_PLATFORM Phase 1.1).
 *
 * Company-scoped Customer (AR) and Vendor (AP) masters so inventory tenants
 * stop retyping client/vendor details on invoices/bills. Deletion is a soft
 * toggle (`isActive = false`) because invoices/bills may reference a party.
 */
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import type { CustomerInput, VendorInput } from '@buildflow/shared';

type PartyShape = {
  name: string;
  businessName?: string | null;
  gstin?: string | null;
  pan?: string | null;
  billingAddress?: string | null;
  shippingAddress?: string | null;
  phone?: string | null;
  email?: string | null;
  paymentTerms?: string | null;
};

function normalizeCustomer(input: CustomerInput) {
  return {
    name: input.name.trim(),
    businessName: input.businessName?.trim() || null,
    gstin: input.gstin?.trim() || null,
    pan: input.pan?.trim() || null,
    billingAddress: input.billingAddress?.trim() || null,
    shippingAddress: input.shippingAddress?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    paymentTerms: input.paymentTerms?.trim() || null,
    creditLimit: input.creditLimit ?? 0,
  };
}

function normalizeVendor(input: VendorInput): PartyShape {
  return {
    name: input.name.trim(),
    businessName: input.businessName?.trim() || null,
    gstin: input.gstin?.trim() || null,
    pan: input.pan?.trim() || null,
    billingAddress: input.billingAddress?.trim() || null,
    shippingAddress: input.shippingAddress?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    paymentTerms: input.paymentTerms?.trim() || null,
  };
}

/**
 * Partial-update helper: keeps only provided keys (undefined = leave unchanged)
 * and trims strings (empty string = clear to null).
 */
function toPatch<T extends Record<string, unknown>>(input: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    out[k] = typeof v === 'string' ? (v.trim() || null) : v;
  }
  return out as Partial<T>;
}

/* ── Customers ─────────────────────────────────────────────────────── */

export async function listCustomers(companyId: string, query: { search?: string; active?: string; limit?: number }) {
  const where: Record<string, unknown> = { companyId };
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { businessName: { contains: query.search, mode: 'insensitive' } },
      { phone: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { gstin: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.active === 'true') where.isActive = true;
  if (query.active === 'false') where.isActive = false;
  return prisma.customer.findMany({
    where,
    orderBy: { name: 'asc' },
    take: Math.min(query.limit ?? 100, 500),
  });
}

export async function getCustomer(companyId: string, id: string) {
  const customer = await prisma.customer.findFirst({ where: { id, companyId } });
  if (!customer) throw ApiError.notFound('Customer not found');
  return customer;
}

export async function createCustomer(companyId: string, input: CustomerInput) {
  return prisma.customer.create({
    data: { companyId, ...normalizeCustomer(input) },
  });
}

export async function updateCustomer(companyId: string, id: string, input: Partial<CustomerInput>) {
  await getCustomer(companyId, id);
  return prisma.customer.update({
    where: { id },
    data: toPatch(input),
  });
}

/** Soft delete (deactivate) - keeps history for invoices that reference it. */
export async function deleteCustomer(companyId: string, id: string) {
  await getCustomer(companyId, id);
  return prisma.customer.update({ where: { id }, data: { isActive: false } });
}

/* ── Vendors ───────────────────────────────────────────────────────── */

export async function listVendors(companyId: string, query: { search?: string; active?: string; limit?: number }) {
  const where: Record<string, unknown> = { companyId };
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { businessName: { contains: query.search, mode: 'insensitive' } },
      { phone: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { gstin: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.active === 'true') where.isActive = true;
  if (query.active === 'false') where.isActive = false;
  return prisma.vendor.findMany({
    where,
    orderBy: { name: 'asc' },
    take: Math.min(query.limit ?? 100, 500),
  });
}

export async function getVendor(companyId: string, id: string) {
  const vendor = await prisma.vendor.findFirst({ where: { id, companyId } });
  if (!vendor) throw ApiError.notFound('Vendor not found');
  return vendor;
}

export async function createVendor(companyId: string, input: VendorInput) {
  return prisma.vendor.create({
    data: { companyId, ...normalizeVendor(input) },
  });
}

export async function updateVendor(companyId: string, id: string, input: Partial<VendorInput>) {
  await getVendor(companyId, id);
  return prisma.vendor.update({
    where: { id },
    data: toPatch(input),
  });
}

/** Soft delete (deactivate) - keeps history for bills that reference it. */
export async function deleteVendor(companyId: string, id: string) {
  await getVendor(companyId, id);
  return prisma.vendor.update({ where: { id }, data: { isActive: false } });
}
