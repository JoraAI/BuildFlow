/**
 * BuildFlow - Resource & Price History Zod validators.
 */
import { z } from 'zod';
import { ResourceType } from '../enums';
import { dateSchema } from './common';
import { isDateOnOrAfter, todayDateOnly } from '../utils/date';

export const resourceTypeSchema = z.nativeEnum(ResourceType);

/** HTTPS URLs or tenant S3 logical URLs (s3://bucket/key). */
export const resourceImageUrlSchema = z
  .string()
  .max(2048)
  .refine(
    (v) => v.startsWith('http://') || v.startsWith('https://') || v.startsWith('s3://'),
    'Image URL must be http(s) or s3://',
  );

export const createResourceSchema = z.object({
  name: z.string().min(1, 'Resource name is required').max(200),
  type: resourceTypeSchema,
  unit: z.string().min(1).max(20),
  rate: z.number().min(0),
  /** Printed MRP; `rate` remains the editable selling price. */
  mrp: z.number().min(0).nullable().optional(),
  gstRate: z.number().min(0).max(100).optional(),
  hsnSacCode: z.string().max(20).optional(),
  brandOrSpec: z.string().max(200).optional(),
  category: z.string().max(100).optional(),
  imageUrl: resourceImageUrlSchema.optional(),
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 1.2): item master fields - all optional
  // so construction resource/estimate flows are unaffected.
  sku: z.string().max(100).optional(),
  itemCode: z.string().max(100).optional(),
  barcode: z.string().max(100).optional(),
  secondaryUnit: z.string().max(20).optional(),
  conversionFactor: z.number().positive().optional(),
  reorderPoint: z.number().nonnegative().optional(),
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 4.1): procurement automation fields -
  // all optional so construction resource/estimate flows are unaffected.
  preferredVendorId: z.string().uuid().optional(),
  reorderQty: z.number().positive().optional(),
  leadTimeDays: z.number().int().positive().optional(),
  // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.2): batch/expiry tracking mode.
  // Only Kirana-vertical inventory tenants may set BATCH_EXPIRY (service guard);
  // construction + other inventory default to NONE (aggregate only).
  trackingMode: z.enum(['NONE', 'BATCH_EXPIRY']).optional(),
});

export type CreateResourceInput = z.infer<typeof createResourceSchema>;

export const updateResourceSchema = createResourceSchema.partial().extend({
  imageUrl: resourceImageUrlSchema.nullable().optional(),
});
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;

export const resourceImageUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
});
export type ResourceImageUploadInput = z.infer<typeof resourceImageUploadSchema>;

export const resourceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  type: resourceTypeSchema.optional(),
  search: z.string().optional(),
  active: z.enum(['true', 'false']).optional(),
});

export type ResourceQueryInput = z.infer<typeof resourceQuerySchema>;

export const resourceIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createPriceHistorySchema = z.object({
  rate: z.coerce.number().min(0, 'Rate must be zero or greater'),
  effectiveDate: dateSchema.refine(
    (d) => isDateOnOrAfter(d, todayDateOnly()),
    'Effective date cannot be in the past',
  ),
  notes: z.string().max(500).optional(),
});

export type CreatePriceHistoryInput = z.infer<typeof createPriceHistorySchema>;

export const importResourcesSchema = z.object({
  resources: z.array(createResourceSchema).min(1, 'At least one resource is required').max(1000),
});
export type ImportResourcesInput = z.infer<typeof importResourcesSchema>;

/**
 * Bulk upsert: each row is matched by (name, type) within the company. If a
 * matching resource exists, it is updated; otherwise a new one is created.
 * Returns { created, updated, ids }.
 */
export const bulkUpsertResourcesSchema = z.object({
  resources: z
    .array(createResourceSchema)
    .min(1, 'At least one resource is required')
    .max(500, 'A single bulk upsert supports up to 500 resources'),
});
export type BulkUpsertResourcesInput = z.infer<typeof bulkUpsertResourcesSchema>;

/**
 * Bulk price update: set the master rate for each resource (by id) and log a
 * MaterialPriceHistory row per change. The `mode` controls how `value` is
 * interpreted:
 *   - 'absolute'  → new rate = value
 *   - 'percent'   → new rate = current * (1 + value/100)   (value may be negative)
 */
export const bulkPriceUpdateModeSchema = z.enum(['absolute', 'percent']);
export type BulkPriceUpdateMode = z.infer<typeof bulkPriceUpdateModeSchema>;

export const bulkPriceUpdateItemSchema = z.object({
  resourceId: z.string().uuid(),
  value: z.number().finite(),
});
export type BulkPriceUpdateItem = z.infer<typeof bulkPriceUpdateItemSchema>;

export const bulkPriceUpdateSchema = z.object({
  mode: bulkPriceUpdateModeSchema,
  effectiveDate: dateSchema.refine(
    (d) => isDateOnOrAfter(d, todayDateOnly()),
    'Effective date cannot be in the past',
  ),
  notes: z.string().max(500).optional(),
  items: z
    .array(bulkPriceUpdateItemSchema)
    .min(1, 'At least one price update is required')
    .max(500, 'A single bulk price update supports up to 500 resources'),
});
export type BulkPriceUpdateInput = z.infer<typeof bulkPriceUpdateSchema>;
