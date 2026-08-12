/**
 * BuildFlow - Customer price list validators (INVENTORY_HORIZONTAL_PLATFORM Phase 9.1).
 *
 * Per-customer (or company-default, `customerId = null`) rate override for a
 * resource. The effective rate resolution order: customer override > company
 * default > `Resource.rate`.
 */
import { z } from 'zod';

export const customerPriceSchema = z.object({
  /** Omit for a company-default price; provide for a per-customer override. */
  customerId: z.string().uuid().nullable().optional(),
  resourceId: z.string().uuid(),
  rate: z.coerce.number().nonnegative(),
});
export type CustomerPriceInput = z.infer<typeof customerPriceSchema>;

export const customerPriceIdParamsSchema = z.object({ id: z.string().uuid() });
