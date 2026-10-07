/**
 * Ice cream manufacturer vertical validators (recipes, production, B2B buyers).
 */
import { z } from 'zod';

export const recipeLineSchema = z.object({
  inputResourceId: z.string().uuid(),
  quantity: z.number().positive(),
});

export const createRecipeSchema = z.object({
  name: z.string().trim().min(1).max(200),
  outputResourceId: z.string().uuid(),
  outputQty: z.number().positive().default(1),
  notes: z.string().trim().max(2000).optional(),
  lines: z.array(recipeLineSchema).min(1).max(50),
});

export const updateRecipeSchema = createRecipeSchema.partial().extend({
  isActive: z.boolean().optional(),
  lines: z.array(recipeLineSchema).min(1).max(50).optional(),
});

export const createProductionBatchSchema = z.object({
  recipeId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
  outputQty: z.number().positive(),
  batchCode: z.string().trim().min(1).max(50),
  manufacturedAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  notes: z.string().trim().max(2000).optional(),
}).refine(
  (v) => !v.manufacturedAt || !v.expiresAt || v.expiresAt >= v.manufacturedAt,
  { message: 'Expiry must be on or after manufacture date', path: ['expiresAt'] },
);

/** Owner invites a customer into Icecream-inventory-buyer with a short join code. */
export const inviteBuyerSchema = z.object({
  customerId: z.string().uuid(),
  /** Required so the buyer can join with code only (no typing email on join). */
  email: z.string().trim().email().max(200),
  name: z.string().trim().max(200).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  /** Code lifetime in hours (default 48, max 168 = 7 days). */
  expiresInHours: z.number().int().min(1).max(168).optional(),
});

export const regenerateBuyerInviteSchema = z.object({
  expiresInHours: z.number().int().min(1).max(168).optional(),
});

/** Preview invite details (owner-prefilled) without consuming the code. */
export const previewBuyerInviteSchema = z.object({
  code: z.string().trim().min(6).max(16),
});

/**
 * Buyer claims a join code. Email/name/phone optional — defaults come from the
 * owner-prefilled invite / customer party.
 */
export const claimBuyerInviteSchema = z.object({
  code: z.string().trim().min(6).max(16),
  email: z.string().trim().email().max(200).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  phone: z.string().trim().max(30).optional().nullable(),
});

export const buyerLoginSchema = z.object({
  /** Email or mobile (same field name kept for API compatibility). */
  email: z.string().trim().min(3).max(254),
  otp: z.string().trim().min(4).max(10),
  /** Manufacturer company id (buyer may belong to one manufacturer). */
  companyId: z.string().uuid().optional(),
});

export const buyerSendOtpSchema = z.object({
  /** Email or mobile (same field name kept for API compatibility). */
  email: z.string().trim().min(3).max(254),
  companyId: z.string().uuid().optional(),
});

/** Buyer-editable party fields (credit limit / payment terms stay owner-only). */
export const buyerUpdateProfileSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  businessName: z.string().trim().max(200).optional().nullable(),
  gstin: z.string().trim().max(20).optional().nullable(),
  pan: z.string().trim().max(20).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email().max(200).optional().nullable(),
  billingAddress: z.string().trim().max(1000).optional().nullable(),
  shippingAddress: z.string().trim().max(1000).optional().nullable(),
  contactName: z.string().trim().max(200).optional().nullable(),
});

export const buyerPlaceOrderSchema = z.object({
  lines: z.array(z.object({
    resourceId: z.string().uuid(),
    quantity: z.number().positive(),
    rate: z.number().nonnegative().optional(),
  })).min(1).max(100),
  notes: z.string().trim().max(2000).optional(),
  expectedDelivery: z.coerce.date().optional(),
});

export const updateSalesShippingSchema = z.object({
  carrier: z.string().trim().max(100).optional().nullable(),
  trackingRef: z.string().trim().max(100).optional().nullable(),
  shippedAt: z.coerce.date().optional().nullable(),
  statusAction: z.enum(['confirm', 'dispatch', 'deliver', 'cancel']).optional(),
});

export const setB2bPublishedSchema = z.object({
  resourceId: z.string().uuid(),
  published: z.boolean(),
});
