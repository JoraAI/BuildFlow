/**
 * BuildFlow — Settings validators (shared between frontend & backend).
 */
import { z } from 'zod';

export const companyUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).optional(),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/).optional(),
  address: z.string().max(500).optional(),
  logoUrl: z.string().min(1).optional(),
  state: z.string().min(2).max(50).optional(),
});

export const myProfileUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(20).optional().nullable(),
});

export const logoUploadSchema = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
});

export const ticketCategorySchema = z.enum([
  'PROFILE_CHANGE',
  'COMPANY_CHANGE',
  'INTEGRATION_SETUP',
  'BILLING',
  'BUG',
  'DATA_FIX',
  'OTHER',
]);

export const createTicketSchema = z.object({
  category: ticketCategorySchema,
  subject: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  payload: z.record(z.unknown()).optional(),
  scope: z.enum(['COMPANY', 'PLATFORM']).default('COMPANY'),
});

export const updateTicketSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'RESOLVED', 'REJECTED', 'ESCALATED']).optional(),
  resolutionNote: z.string().max(2000).optional(),
  applyChanges: z.boolean().optional(),
});

export const platformLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const platformCompanyUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).optional(),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/).optional(),
  address: z.string().max(500).optional().nullable(),
  state: z.string().min(2).max(50).optional(),
});

export const platformSubscriptionUpdateSchema = z.object({
  subscriptionPlan: z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE']).optional(),
  subscriptionStatus: z.enum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED']).optional(),
  trialEndsAt: z.string().datetime().optional().nullable(),
});

export const platformUserUpdateSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(20).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const platformTicketUpdateSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'RESOLVED', 'REJECTED']).optional(),
  resolutionNote: z.string().max(2000).optional(),
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

export const integrationProviderSchema = z.enum([
  'TWILIO',
  'RAZORPAY',
  'STRIPE',
  'TALLY',
  'GOOGLE_MAPS',
  'LLM',
  'S3',
]);

export const twilioIntegrationSchema = z.object({
  accountSid: z.string().min(1).optional(),
  authToken: z.string().optional(),
  whatsappFrom: z.string().optional(),
  smsFrom: z.string().optional(),
});

export const razorpayIntegrationSchema = z.object({
  keyId: z.string().min(1).optional(),
  keySecret: z.string().optional(),
  webhookSecret: z.string().optional(),
});

export const stripeIntegrationSchema = z.object({
  secretKey: z.string().optional(),
  webhookSecret: z.string().optional(),
});

export const tallyIntegrationSchema = z.object({
  sales: z.string().optional(),
  purchase: z.string().optional(),
  cgst: z.string().optional(),
  sgst: z.string().optional(),
  igst: z.string().optional(),
  tdsPayable: z.string().optional(),
  roundOff: z.string().optional(),
  bank: z.string().optional(),
});

export const googleMapsIntegrationSchema = z.object({
  apiKey: z.string().optional(),
});

export const llmIntegrationSchema = z.object({
  apiUrl: z.string().url().optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
});

export const s3IntegrationSchema = z.object({
  region: z.string().optional(),
  bucket: z.string().optional(),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
});

export const saasCheckoutSchema = z.object({
  plan: z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE']),
  gateway: z.enum(['razorpay', 'stripe']).default('razorpay'),
});

export type CompanyUpdateInput = z.infer<typeof companyUpdateSchema>;
export type UserRoleUpdateInput = z.infer<typeof userRoleUpdateSchema>;
export type MyProfileUpdateInput = z.infer<typeof myProfileUpdateSchema>;
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type PlatformLoginInput = z.infer<typeof platformLoginSchema>;
export type PlatformCompanyUpdateInput = z.infer<typeof platformCompanyUpdateSchema>;
export type PlatformSubscriptionUpdateInput = z.infer<typeof platformSubscriptionUpdateSchema>;
export type PlatformUserUpdateInput = z.infer<typeof platformUserUpdateSchema>;
export type PlatformTicketUpdateInput = z.infer<typeof platformTicketUpdateSchema>;
export type IntegrationProviderInput = z.infer<typeof integrationProviderSchema>;
export type TwilioIntegrationInput = z.infer<typeof twilioIntegrationSchema>;
export type RazorpayIntegrationInput = z.infer<typeof razorpayIntegrationSchema>;
export type StripeIntegrationInput = z.infer<typeof stripeIntegrationSchema>;
export type TallyIntegrationInput = z.infer<typeof tallyIntegrationSchema>;
export type GoogleMapsIntegrationInput = z.infer<typeof googleMapsIntegrationSchema>;
export type LlmIntegrationInput = z.infer<typeof llmIntegrationSchema>;
export type S3IntegrationInput = z.infer<typeof s3IntegrationSchema>;
export type SaasCheckoutInput = z.infer<typeof saasCheckoutSchema>;