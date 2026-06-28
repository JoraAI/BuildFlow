/**
 * BuildFlow - Material rate resolution validators.
 */
import { z } from 'zod';

export const materialRateSourceSchema = z.enum([
  'PROJECT',
  'BOQ',
  'ESTIMATE',
  'REGION',
  'LAST_PO',
  'CATALOG',
  'MANUAL',
]);
export type MaterialRateSource = z.infer<typeof materialRateSourceSchema>;

export const projectResourceRateParamsSchema = z.object({
  id: z.string().uuid(),
  resourceId: z.string().uuid(),
});

export const resolveMaterialRateQuerySchema = z.object({
  boqItemId: z.string().uuid().optional(),
});

export type ResolveMaterialRateQuery = z.infer<typeof resolveMaterialRateQuerySchema>;

export interface ResolvedMaterialRate {
  rate: number;
  source: MaterialRateSource;
  sourceRef?: string;
}

/** Alert when last PO rate exceeds planned rate by more than this percent. */
export const RATE_VARIANCE_ALERT_PCT = 10;

export interface MaterialRateVarianceRow {
  resourceId: string;
  name: string;
  unit: string;
  plannedRate: number;
  plannedSource: MaterialRateSource;
  catalogRate: number;
  lastPoRate: number | null;
  lastPoRef: string | null;
  variancePct: number | null;
  overThreshold: boolean;
}
