/**
 * BuildFlow - Settings validators (shared between frontend & backend).
 */
import { z } from 'zod';
import { InventoryBusinessProfile } from '../inventory-profile';
import { creditLimitPolicySchema } from './transactions';

const inventoryLanguageEnum = z.enum([
  'en',
  'hi',
  'bn',
  'te',
  'mr',
  'ta',
  'ur',
  'gu',
  'kn',
  'ml',
  'pa',
  'ar',
  'es',
  'fr',
]);

/** Valid inventory business profiles (mirrors the shared enum). */
const inventoryProfileEnum = z.enum([
  InventoryBusinessProfile.RETAIL,
  InventoryBusinessProfile.WHOLESALE,
  InventoryBusinessProfile.DISTRIBUTION,
  InventoryBusinessProfile.TRADING,
  InventoryBusinessProfile.MATERIAL_SUPPLIER,
  InventoryBusinessProfile.EQUIPMENT,
  InventoryBusinessProfile.GENERAL,
]);

export const companyUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).optional(),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/).optional(),
  address: z.string().max(500).optional(),
  logoUrl: z.string().min(1).optional(),
  state: z.string().min(2).max(50).optional(),
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 0): accepted by the validator for all
  // companies, but the service IGNORES it on construction plans (hidden field).
  inventoryProfile: inventoryProfileEnum.optional(),
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 2.5): credit-limit enforcement policy.
  creditLimitPolicy: creditLimitPolicySchema.optional(),
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 4.4): PO approval thresholds (₹),
  // inventory-only. 0 disables the banding (POs auto-approve like today).
  poAutoApproveBelow: z.number().nonnegative().optional(),
  poOwnerApproveAbove: z.number().nonnegative().optional(),
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
  subscriptionPlan: z.enum(['INVENTORY', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE']).optional(),
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
  role: z.enum([
    'OWNER',
    'PM',
    'DPM',
    'QC',
    'MECHANICAL_MANAGER',
    'STORE_INCHARGE',
    'WEIGHBRIDGE_INCHARGE',
    'SITE_SUPERVISOR',
    'SUPERVISOR',
    'ACCOUNTANT',
    'INVENTORY_MANAGER',
  ]).optional(),
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
  retention: z.string().optional(),
  advanceRecovery: z.string().optional(),
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
  // ENTERPRISE is contact-sales only (no self-serve checkout amount).
  plan: z.enum(['INVENTORY', 'STARTER', 'PROFESSIONAL']),
  gateway: z.enum(['razorpay', 'stripe']).default('razorpay'),
});

export type CompanyUpdateInput = z.infer<typeof companyUpdateSchema>;
export type UserRoleUpdateInput = z.infer<typeof userRoleUpdateSchema>;

// RPT-C2c: Zod validator for report settings PATCH
export const updateReportSettingsSchema = z.object({
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a hex color like #F59E0B').optional(),
  showLogo: z.boolean().optional(),
  showWatermark: z.boolean().optional(),
  footerText: z.string().max(500).optional(),
  // Inventory-only app language preference, stored in the shared settings JSON
  // so construction remains untouched.
  inventoryLanguage: inventoryLanguageEnum.optional(),
});
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