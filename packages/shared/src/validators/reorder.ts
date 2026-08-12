/**
 * BuildFlow - Reorder automation validators (INVENTORY_HORIZONTAL_PLATFORM Phase 4).
 *
 * 4.2 Reorder suggestions: items where on-hand < reorderPoint, with preferred
 * vendor + suggested qty.
 * 4.3 One-click purchase: create an auto-approved indent (+ PO) from selected
 * low-stock items, reusing createRequisition / createPO.
 */
import { z } from 'zod';

export const reorderSuggestionsQuerySchema = z.object({
  /** Optional filter: only these resource ids (defaults to ALL low-stock). */
  resourceIds: z.string().uuid().optional(),
});

export const orderReorderItemsSchema = z.object({
  /** Resource ids to order. Empty = order every current low-stock item. */
  resourceIds: z.array(z.string().uuid()).min(1, 'Select at least one item to order'),
});
export type OrderReorderItemsInput = z.infer<typeof orderReorderItemsSchema>;
