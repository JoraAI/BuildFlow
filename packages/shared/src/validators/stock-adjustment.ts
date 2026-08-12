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
});
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

/**
 * One opening-stock line. A row may identify the item by id, SKU, itemCode or
 * name (exactly one is required); the service resolves it within the company.
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
