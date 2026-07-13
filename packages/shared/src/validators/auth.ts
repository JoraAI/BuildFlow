/**
 * BuildFlow - Auth Zod validators
 */
import { z } from 'zod';
import { gstinSchema, panSchema } from './common';

/** Strong-ish password: 8+ chars, 1 upper, 1 lower, 1 number. */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[a-z]/, 'Must contain a lowercase letter')
  .regex(/[0-9]/, 'Must contain a number');

export const emailSchema = z.string().trim().toLowerCase().email('Invalid email').max(254);

/* ------------------------------------------------------------------ */
/* POST /api/auth/register - company + owner creation (setup only)     */
/* ------------------------------------------------------------------ */

export const registerCompanySchema = z.object({
  // Company
  companyName: z.string().trim().min(2).max(120),
  gstin: gstinSchema,
  pan: panSchema,
  address: z.string().trim().max(500).optional().or(z.literal('')),
  state: z.string().trim().min(2).max(60),

  // Owner
  ownerName: z.string().trim().min(2).max(120),
  ownerEmail: emailSchema,
  password: passwordSchema,
});

export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>;

/* ------------------------------------------------------------------ */
/* POST /api/auth/login                                                */
/* ------------------------------------------------------------------ */

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

/* ------------------------------------------------------------------ */
/* POST /api/auth/refresh                                              */
/* ------------------------------------------------------------------ */

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RefreshInput = z.infer<typeof refreshSchema>;

/* ------------------------------------------------------------------ */
/* POST /api/auth/forgot-password (stub for Phase 1)                   */
/* ------------------------------------------------------------------ */

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/* ------------------------------------------------------------------ */
/* Invite-based team signup                                            */
/* ------------------------------------------------------------------ */

export const inviteRoleSchema = z.enum([
  'PM',
  'DPM',
  'QC',
  'MECHANICAL_MANAGER',
  'STORE_INCHARGE',
  'WEIGHBRIDGE_INCHARGE',
  'SITE_SUPERVISOR',
  'ACCOUNTANT',
]);

export const createUserInviteSchema = z.object({
  email: emailSchema,
  role: inviteRoleSchema.default('PM'),
});

export type CreateUserInviteInput = z.infer<typeof createUserInviteSchema>;

export const acceptInviteSchema = z.object({
  token: z.string().min(16).max(256),
  name: z.string().trim().min(2).max(120),
  password: passwordSchema,
});

export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;