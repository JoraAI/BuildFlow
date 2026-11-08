import { z } from 'zod';

export const gstHandoffStatusSchema = z.enum(['DRAFT', 'SENT', 'IN_PROGRESS', 'FILED']);

export const createGstHandoffPackSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  label: z.string().trim().min(2).max(120).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
});
export type CreateGstHandoffPackInput = z.infer<typeof createGstHandoffPackSchema>;

export const updateGstHandoffPackDraftSchema = z.object({
  label: z.string().trim().min(2).max(120).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  openingCashBalance: z.number().finite().optional().nullable(),
});
export type UpdateGstHandoffPackDraftInput = z.infer<typeof updateGstHandoffPackDraftSchema>;

export const updateGstHandoffPackStatusSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'FILED']),
});
export type UpdateGstHandoffPackStatusInput = z.infer<typeof updateGstHandoffPackStatusSchema>;

export const auditorManualEntrySchema = z.object({
  entryType: z.enum(['JOURNAL', 'BANK_NOTE', 'GST_NOTE']),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().finite().optional().nullable(),
  narration: z.string().trim().min(2).max(2000),
});
export type AuditorManualEntryInput = z.infer<typeof auditorManualEntrySchema>;
