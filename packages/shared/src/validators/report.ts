/**
 * BuildFlow - Zod validators for Daily Reports, Material Usage & Attendance.
 */
import { z } from 'zod';
import { idSchema, paginationSchema } from './common';

/* ------------------------------------------------------------------ */
/* Daily Report                                                        */
/* ------------------------------------------------------------------ */

export const weatherSchema = z.enum(['SUNNY', 'CLOUDY', 'RAIN', 'STORM', 'FOG']);
export type Weather = z.infer<typeof weatherSchema>;

export const siteStatusSchema = z.enum(['ON_SCHEDULE', 'DELAYED', 'BLOCKED']);
export type SiteStatus = z.infer<typeof siteStatusSchema>;

export const materialUsageInputSchema = z.object({
  resourceId: idSchema,
  quantityUsed: z.number().positive('Quantity must be greater than 0'),
  notes: z.string().max(500).optional(),
  taskId: idSchema.optional(),
  boqItemId: idSchema.optional(),
  postToBoqMeasurement: z.boolean().optional(),
});
export type MaterialUsageInput = z.infer<typeof materialUsageInputSchema>;

export const dailyReportTaskUpdateSchema = z.object({
  taskId: idSchema,
  progressPct: z.number().int().min(0).max(100),
});
export type DailyReportTaskUpdateInput = z.infer<typeof dailyReportTaskUpdateSchema>;

export const createDailyReportSchema = z.object({
  reportDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date'),
  weather: weatherSchema.optional(),
  siteStatus: siteStatusSchema.optional(),
  workDone: z.string().max(5000).optional(),
  issues: z.string().max(5000).optional(),
  workersCount: z.number().int().min(0).max(100000).optional(),
  materialUsages: z.array(materialUsageInputSchema).optional(),
  taskUpdates: z.array(dailyReportTaskUpdateSchema).optional(),
  deductStock: z.boolean().optional(),
});
export type CreateDailyReportInput = z.infer<typeof createDailyReportSchema>;

export const updateDailyReportSchema = createDailyReportSchema.partial();
export type UpdateDailyReportInput = z.infer<typeof updateDailyReportSchema>;

export const dailyReportIdParamsSchema = z.object({
  id: idSchema,
});

export const materialUsageIdParamsSchema = z.object({
  usageId: idSchema,
});

export const projectIdReportDateParamsSchema = z.object({
  id: idSchema,
});

export const reportListQuerySchema = paginationSchema.extend({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

/* ------------------------------------------------------------------ */
/* Photo upload                                                        */
/* ------------------------------------------------------------------ */

export const photoUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  size: z.number().int().positive().max(5 * 1024 * 1024, 'Max 5MB per photo'),
});
export type PhotoUploadInput = z.infer<typeof photoUploadSchema>;

export const confirmPhotoUploadSchema = z.object({
  s3Keys: z.array(z.string().min(1)).min(1).max(10),
});
export type ConfirmPhotoUploadInput = z.infer<typeof confirmPhotoUploadSchema>;

/* ------------------------------------------------------------------ */
/* Attendance / Geo-fence                                              */
/* ------------------------------------------------------------------ */

export const checkInSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  notes: z.string().max(500).optional(),
});
export type CheckInInput = z.infer<typeof checkInSchema>;

export const attendanceQuerySchema = z.object({
  date: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date').optional(),
  userId: idSchema.optional(),
});
