/**
 * BuildFlow - Stock adjustment validators (INVENTORY_HORIZONTAL_PLATFORM Phase 1.3/1.4).
 *
 * Adjustments write `StockMovementType.ADJUST` rows with an audit reason, e.g.
 * DAMAGE / LOSS / THEFT / EXPIRY / STOCKTAKE / OPENING_STOCK / FOUND_STOCK /
 * CORRECTION / OTHER. Opening-stock import reuses the OPENING_STOCK reason.
 */
import { z } from 'zod';

export const StockAdjustReason = {
  DAMAGE: 'DAMAGE',
  LOSS: 'LOSS',
  THEFT: 'THEFT',
  EXPIRY: 'EXPIRY',
  STOCKTAKE: 'STOCKTAKE',
  OPENING_STOCK: 'OPENING_STOCK',
  FOUND_STOCK: 'FOUND_STOCK',
  CORRECTION: 'CORRECTION',
  OTHER: 'OTHER',
} as const;
export type StockAdjustReason = (typeof StockAdjustReason)[keyof typeof StockAdjustReason];

export const stockAdjustReasonSchema = z.enum([
  StockAdjustReason.DAMAGE,
  StockAdjustReason.LOSS,
  StockAdjustReason.THEFT,
  StockAdjustReason.EXPIRY,
  StockAdjustReason.STOCKTAKE,
  StockAdjustReason.OPENING_STOCK,
  StockAdjustReason.FOUND_STOCK,
  StockAdjustReason.CORRECTION,
  StockAdjustReason.OTHER,
]);

/** Signed quantity delta: positive adds stock, negative removes stock. */
export const adjustStockSchema = z.object({
  resourceId: z.string().uuid(),
  delta: z.coerce
    .number()
    .finite()
    .refine((n) => n !== 0, 'Adjustment delta cannot be zero'),
  reason: stockAdjustReasonSchema,
  notes: z.string().max(2000).optional(),
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 3.1): adjust a specific warehouse
  // (inventory only; omitted = company default location).
  locationId: z.string().uuid().optional(),
  // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.2): lot metadata for tracked
  // items - used when an increase creates/extends a batch lot (omitted → the
  // service generates an ADJ-<ts> lot). Decreases FEFO-allocate existing lots.
  batchCode: z.string().max(50).optional(),
  manufacturedAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
});
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

/**
 * One opening-stock line. A row may identify the item by id, SKU, itemCode or
 * name (exactly one is required); the service resolves it within the company.
 * Phase 11.2: optional lot fields - batch-tracked items get a batch row
 * (omitted batchCode → the service generates an OPEN-<ts>-<n> lot).
 */
export const openingStockLineSchema = z
  .object({
    resourceId: z.string().uuid().optional(),
    sku: z.string().max(100).optional(),
    itemCode: z.string().max(100).optional(),
    name: z.string().max(200).optional(),
    quantity: z.coerce.number().positive(),
    /** Optional per-item catalog rate to set alongside opening stock. */
    rate: z.coerce.number().nonnegative().optional(),
    // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.2): lot code + dates.
    batchCode: z.string().max(50).optional(),
    manufacturedAt: z.coerce.date().optional(),
    expiresAt: z.coerce.date().optional(),
  })
  .refine((l) => l.resourceId || l.sku || l.itemCode || l.name, {
    message: 'Each line must identify the item by id, SKU, itemCode or name',
  });

export const openingStockImportSchema = z.object({
  lines: z.array(openingStockLineSchema).min(1, 'At least one line is required').max(500),
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 3.1): target warehouse (inventory only;
  // omitted = company default location).
  locationId: z.string().uuid().optional(),
});
export type OpeningStockImportInput = z.infer<typeof openingStockImportSchema>;

const quickReceiptLineSchema = z.object({
  resourceId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  unitCost: z.coerce.number().nonnegative(),
  batchCode: z.string().trim().max(50).optional(),
  manufacturedAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
}).refine(
  (line) => !line.manufacturedAt || !line.expiresAt || line.expiresAt >= line.manufacturedAt,
  { message: 'Expiry date must be on or after manufacture date', path: ['expiresAt'] },
);

/** Small vendor purchase received without a formal PO/GRN. */
export const quickVendorReceiptSchema = z.object({
  vendorId: z.string().uuid().optional(),
  vendorName: z.string().trim().max(200).optional(),
  invoiceNumber: z.string().trim().max(100).optional(),
  receivedDate: z.coerce.date(),
  locationId: z.string().uuid().optional(),
  notes: z.string().trim().max(1000).optional(),
  lines: z.array(quickReceiptLineSchema).min(1).max(100),
}).refine(
  (input) => Boolean(input.vendorId || input.vendorName),
  { message: 'Select or enter a vendor', path: ['vendorId'] },
);
export type QuickVendorReceiptInput = z.infer<typeof quickVendorReceiptSchema>;
