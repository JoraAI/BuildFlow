/**
 * BuildFlow — Settings validators (shared between frontend & backend).
 */
import { z } from 'zod';

export const companyUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).optional(),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/).optional(),
  address: z.string().max(500).optional(),
  logoUrl: z.string().url().optional(),
  state: z.string().min(2).max(50).optional(),
});

export const userRoleUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(20).optional(),
  role: z.enum(['OWNER', 'PM', 'SUPERVISOR', 'ACCOUNTANT']).optional(),
  isActive: z.boolean().optional(),
});

export const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  userId: z.string().uuid().optional(),
  entityType: z.string().optional(),
});

export type CompanyUpdateInput = z.infer<typeof companyUpdateSchema>;
export type UserRoleUpdateInput = z.infer<typeof userRoleUpdateSchema>;