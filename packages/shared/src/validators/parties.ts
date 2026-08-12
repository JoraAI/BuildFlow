/**
 * BuildFlow - Party master validators (INVENTORY_HORIZONTAL_PLATFORM Phase 1.1).
 *
 * Customers (AR) and Vendors (AP) are company-scoped masters so inventory
 * tenants stop retyping names on every invoice/bill. Invoices/Bills keep
 * free-text name fields for legacy rows; `customerId`/`vendorId` are optional
 * links back to the master (null for legacy/pre-master documents).
 */
import { z } from 'zod';

const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/** Shared contact fields for customers and vendors. */
const partyContactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  businessName: z.string().max(200).optional(),
  gstin: z.string().regex(gstinPattern, 'Invalid GSTIN').optional().or(z.literal('')),
  pan: z.string().regex(panPattern, 'Invalid PAN').optional().or(z.literal('')),
  billingAddress: z.string().max(500).optional(),
  shippingAddress: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email('Invalid email').max(200).optional().or(z.literal('')),
  paymentTerms: z.string().max(100).optional(),
});

export const customerSchema = partyContactSchema.extend({
  /** Credit limit in ₹ (0 = no credit / upfront only). */
  creditLimit: z.coerce.number().nonnegative().max(1e12).optional(),
});
export type CustomerInput = z.infer<typeof customerSchema>;

export const vendorSchema = partyContactSchema;
export type VendorInput = z.infer<typeof vendorSchema>;

export const updateCustomerSchema = customerSchema.partial();
export const updateVendorSchema = vendorSchema.partial();

export const partyQuerySchema = z.object({
  search: z.string().optional(),
  active: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const partyIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const partyListResponseSchema = z.object({
  customers: z.array(customerSchema.partial().extend({ id: z.string().uuid() })),
  vendors: z.array(vendorSchema.partial().extend({ id: z.string().uuid() })),
});
