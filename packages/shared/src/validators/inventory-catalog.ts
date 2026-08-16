/**
 * BuildFlow - Kirana vertical catalog validators
 * (INVENTORY_KIRANA_RETAIL_WHOLESALE Phase 11.1).
 *
 * K1 - `InventoryVertical` (KIRANA) is a catalog template, NOT a business
 * profile. Apply is insert-missing-only (K3) and OWNER-gated.
 */
import { z } from 'zod';
import { InventoryVertical } from '../inventory-profile';

export const inventoryVerticalSchema = z.enum([InventoryVertical.KIRANA] as const);

export const catalogApplySchema = z.object({
  template: inventoryVerticalSchema,
});

export const catalogPreviewSchema = z.object({
  template: inventoryVerticalSchema.optional(),
});

/**
 * K2 follow-up (11.1.5b): OWNER vertical picker. `null` clears the vertical
 * (RETAIL/WHOLESALE can opt in/out of the Kirana pack). The service rejects
 * any profile other than RETAIL/WHOLESALE, and preview/apply remain gated on
 * `inventoryVertical === KIRANA`.
 */
export const catalogVerticalSchema = z.object({
  vertical: inventoryVerticalSchema.nullable(),
});

export const catalogLibraryQuerySchema = z.object({
  search: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(300).default(30),
});

const optionalDate = z.coerce.date().optional();
export const catalogSelectedItemSchema = z.object({
  templateKey: z.string().min(1).max(100).optional(),
  custom: z.object({
    name: z.string().trim().min(1).max(200),
    sku: z.string().trim().min(1).max(100),
    unit: z.string().trim().min(1).max(20),
    category: z.string().trim().max(100).optional(),
    gstRate: z.number().min(0).max(100).default(0),
    hsn: z.string().trim().max(20).optional(),
  }).optional(),
  mrp: z.number().nonnegative(),
  rate: z.number().nonnegative(),
  quantity: z.number().positive(),
  barcode: z.string().max(100).optional(),
  batchCode: z.string().max(50).optional(),
  manufacturedAt: optionalDate,
  expiresAt: optionalDate,
}).refine(
  (v) => Boolean(v.templateKey) !== Boolean(v.custom),
  { message: 'Choose one library SKU or provide one custom SKU' },
).refine(
  (v) => !v.manufacturedAt || !v.expiresAt || v.expiresAt >= v.manufacturedAt,
  { message: 'Expiry date must be on or after manufacture date', path: ['expiresAt'] },
).refine(
  (v) => v.mrp === 0 || v.rate <= v.mrp,
  { message: 'Selling price cannot exceed MRP', path: ['rate'] },
);

export const catalogImportSelectedSchema = z.object({
  items: z.array(catalogSelectedItemSchema).min(1).max(100),
  locationId: z.string().uuid().optional(),
});

/** Adds products to the tenant item master without creating stock. */
export const catalogMasterItemSchema = z.object({
  templateKey: z.string().min(1).max(100).optional(),
  custom: z.object({
    name: z.string().trim().min(1).max(200),
    sku: z.string().trim().min(1).max(100),
    unit: z.string().trim().min(1).max(20),
    category: z.string().trim().max(100).optional(),
    gstRate: z.number().min(0).max(100).default(0),
    hsn: z.string().trim().max(20).optional(),
  }).optional(),
  mrp: z.number().nonnegative(),
  rate: z.number().nonnegative(),
  barcode: z.string().trim().max(100).optional(),
}).refine(
  (v) => Boolean(v.templateKey) !== Boolean(v.custom),
  { message: 'Choose one library product or provide one custom item' },
).refine(
  (v) => v.mrp === 0 || v.rate <= v.mrp,
  { message: 'Selling price cannot exceed MRP', path: ['rate'] },
);

export const catalogImportItemsSchema = z.object({
  items: z.array(catalogMasterItemSchema).min(1).max(100),
});

export const batchMetadataUpdateSchema = z.object({
  manufacturedAt: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
}).refine(
  (v) => !v.manufacturedAt || !v.expiresAt || v.expiresAt >= v.manufacturedAt,
  { message: 'Expiry date must be on or after manufacture date', path: ['expiresAt'] },
);

export const batchMetadataParamsSchema = z.object({
  id: z.string().uuid(),
});
