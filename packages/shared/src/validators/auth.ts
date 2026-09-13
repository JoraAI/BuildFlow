/**
 * BuildFlow - Auth Zod validators
 */
import { z } from 'zod';
import { gstinSchema, panSchema, phoneSchema } from './common';

/** Strong-ish password: 8+ chars, 1 upper, 1 lower, 1 number. */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[a-z]/, 'Must contain a lowercase letter')
  .regex(/[0-9]/, 'Must contain a number');

export const emailSchema = z.string().trim().toLowerCase().email('Invalid email').max(254);

const optionalEmail = z
  .union([emailSchema, z.literal('')])
  .optional()
  .transform((v) => (v ? v : undefined));

const optionalPhone = z
  .union([phoneSchema, z.literal('')])
  .optional()
  .transform((v) => (v ? v : undefined));

/* ------------------------------------------------------------------ */
/* POST /api/auth/register - company + owner creation (setup only)     */
/* ------------------------------------------------------------------ */

export const registerCompanySchema = z
  .object({
    // Company
    companyName: z
      .string()
      .trim()
      .min(2, 'Company name must be at least 2 characters')
      .max(120, 'Company name is too long'),
    gstin: gstinSchema,
    pan: panSchema,
    address: z.string().trim().max(500, 'Address is too long').optional().or(z.literal('')),
    state: z
      .string()
      .trim()
      .min(2, 'State is required')
      .max(60, 'State is too long'),

    // Owner — email or mobile (at least one required)
    ownerName: z
      .string()
      .trim()
      .min(2, 'Owner name must be at least 2 characters')
      .max(120, 'Owner name is too long'),
    ownerEmail: optionalEmail,
    ownerPhone: optionalPhone,
    password: passwordSchema,

    // INVENTORY_PRODUCT: dedicated inventory signup path
    product: z.enum(['inventory', 'construction']).default('construction'),
  })
  .refine((d) => Boolean(d.ownerEmail || d.ownerPhone), {
    message: 'Owner email or mobile number is required',
    path: ['ownerEmail'],
  });

export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>;

/* ------------------------------------------------------------------ */
/* POST /api/auth/refresh                                              */
/* ------------------------------------------------------------------ */

export const refreshSchema = z.object({
  /** Optional when the httpOnly cookie carries the refresh token (web). */
  refreshToken: z.string().min(1).optional(),
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
  'OWNER',
  'PM',
  'DPM',
  'QC',
  'MECHANICAL_MANAGER',
  'STORE_INCHARGE',
  'WEIGHBRIDGE_INCHARGE',
  'SITE_SUPERVISOR',
  'ACCOUNTANT',
  'INVENTORY_MANAGER',
]);

export const createUserInviteSchema = z
  .object({
    email: optionalEmail,
    phone: optionalPhone,
    role: inviteRoleSchema.default('PM'),
  })
  .refine((d) => Boolean(d.email || d.phone), {
    message: 'Email or mobile number is required',
    path: ['email'],
  });

export type CreateUserInviteInput = z.infer<typeof createUserInviteSchema>;

/** Owner creates a ready-to-use login (password shared out-of-band). */
export const createTeamUserSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: optionalEmail,
    phone: optionalPhone,
    password: passwordSchema,
    role: inviteRoleSchema.default('PM'),
  })
  .refine((d) => Boolean(d.email || d.phone), {
    message: 'Email or mobile number is required',
    path: ['email'],
  });

export type CreateTeamUserInput = z.infer<typeof createTeamUserSchema>;

export const sendInviteOtpSchema = z.object({
  token: z.string().min(16).max(256),
});

export type SendInviteOtpInput = z.infer<typeof sendInviteOtpSchema>;

/** Send login OTP to email or mobile (same identifier field as login). */
export const sendLoginOtpSchema = z.object({
  email: z.string().trim().min(3, 'Enter email or mobile number').max(254),
});

export type SendLoginOtpInput = z.infer<typeof sendLoginOtpSchema>;

/**
 * Accept invite: name + OTP (email or phone locked on invite).
 * Password is not collected — login is OTP-only.
 */
export const acceptInviteSchema = z.object({
  token: z.string().min(16).max(256),
  name: z.string().trim().min(2).max(120),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

/** Login: email or mobile + OTP only. */
export const loginSchema = z.object({
  email: z.string().trim().min(3, 'Enter email or mobile number').max(254),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

export type LoginInput = z.infer<typeof loginSchema>;