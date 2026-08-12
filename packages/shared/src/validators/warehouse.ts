/**
 * BuildFlow - Warehouse ops validators (INVENTORY_HORIZONTAL_PLATFORM Phase 3).
 * Multi-warehouse (locations), stock transfers, stock counts, barcode identify.
 * All company + STORE project scoped; gated by `multi_warehouse` / `barcode` flags.
 */
import { z } from 'zod';

/* ── 3.1 Multi-warehouse ──────────────────────────────────────────── */

export const warehouseSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export type CreateWarehouseInput = z.infer<typeof warehouseSchema>;

export const updateWarehouseSchema = warehouseSchema.partial();
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;

/* ── 3.2 Stock transfers ──────────────────────────────────────────── */

export const transferLineSchema = z.object({
  resourceId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
});

export const createTransferOrderSchema = z
  .object({
    fromLocationId: z.string().uuid(),
    toLocationId: z.string().uuid(),
    notes: z.string().max(2000).optional(),
    lines: z.array(transferLineSchema).min(1).max(100),
  })
  .refine((t) => t.fromLocationId !== t.toLocationId, {
    message: 'From and to locations must be different',
    path: ['toLocationId'],
  });
export type CreateTransferOrderInput = z.infer<typeof createTransferOrderSchema>;

export const transferActionSchema = z.object({ action: z.enum(['dispatch', 'receive', 'cancel']) });

/* ── 3.3 Stock count / stocktake ──────────────────────────────────── */

export const stockCountLineSchema = z.object({
  resourceId: z.string().uuid(),
  /** Physical counted quantity at the location. Variance is computed server-side. */
  countedQty: z.coerce.number().nonnegative(),
});

export const createStockCountSchema = z.object({
  locationId: z.string().uuid(),
  countDate: z.coerce.date(),
  notes: z.string().max(2000).optional(),
  lines: z.array(stockCountLineSchema).min(1).max(500),
});
export type CreateStockCountInput = z.infer<typeof createStockCountSchema>;

export const stockCountActionSchema = z.object({ action: z.enum(['approve', 'cancel']) });

/* ── 3.4 Barcode identify ─────────────────────────────────────────── */

export const barcodeParamsSchema = z.object({ code: z.string().min(1).max(100) });
