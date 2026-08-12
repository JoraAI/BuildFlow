/**
 * BuildFlow - Quote → Sales Order validators (INVENTORY_HORIZONTAL_PLATFORM Phase 9.2).
 *
 * Optional quote path: DRAFT → SENT → ACCEPTED/REJECTED. An ACCEPTED quote can be
 * converted to a Sales Order (lines/rates/customer copied). The Issue → Invoice
 * and SO → DC → Invoice paths stay unchanged.
 */
import { z } from 'zod';

export const quoteLineSchema = z.object({
  resourceId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  unit: z.string().min(1).max(20),
  rate: z.coerce.number().nonnegative(),
  gstRate: z.coerce.number().min(0).max(28).optional(),
});
export type QuoteLineInput = z.infer<typeof quoteLineSchema>;

export const createQuoteSchema = z.object({
  quoteNumber: z.string().min(1).max(50).optional(),
  customerId: z.string().uuid().optional(),
  customerName: z.string().min(1).max(200),
  quoteDate: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
  lines: z.array(quoteLineSchema).min(1),
});
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;

export const quoteStatusActionSchema = z.object({
  action: z.enum(['send', 'accept', 'reject']),
});
export type QuoteStatusActionInput = z.infer<typeof quoteStatusActionSchema>;
