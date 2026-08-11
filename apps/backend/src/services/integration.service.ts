/**
 * BuildFlow - Per-company integration credentials & settings.
 *
 * Company-specific: Twilio/WhatsApp, Razorpay, Stripe, Tally ledger map, Google Maps.
 * Platform .env values are used as fallback when a company has not configured its own.
 */
import type { IntegrationProvider, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';

export interface TallyLedgerMap {
  sales?: string;
  purchase?: string;
  salesParty?: string;
  purchaseParty?: string;
  cgst?: string;
  sgst?: string;
  igst?: string;
  tdsPayable?: string;
  retention?: string;
  advanceRecovery?: string;
  roundOff?: string;
  bank?: string;
}

export type IntegrationSource = 'company' | 'platform' | 'none';

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  whatsappFrom?: string;
  smsFrom?: string;
}

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
}

export interface StripeConfig {
  secretKey: string;
  webhookSecret?: string;
}

export interface GoogleMapsConfig {
  apiKey: string;
}

export interface LlmConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
}

export interface S3Config {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

const SECRET_KEYS = new Set([
  'authToken',
  'keySecret',
  'webhookSecret',
  'secretKey',
  'apiKey',
  'secretAccessKey',
]);

function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 4) return '••••';
  return `••••${value.slice(-4)}`;
}

export function isMaskedSecret(value: string): boolean {
  return value.startsWith('••••');
}

function maskSettings(settings: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(settings)) {
    if (typeof v === 'string' && SECRET_KEYS.has(k)) {
      out[k] = maskSecret(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function mergeSettings(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    if (v === undefined) continue;
    if (typeof v === 'string' && SECRET_KEYS.has(k)) {
      if (!v.trim() || isMaskedSecret(v)) continue;
    }
    merged[k] = v;
  }
  return merged;
}

async function readCompanySettings(
  companyId: string,
  provider: IntegrationProvider,
): Promise<Record<string, unknown>> {
  const row = await prisma.companyIntegration.findUnique({
    where: { companyId_provider: { companyId, provider } },
    select: { settings: true },
  });
  if (!row?.settings || typeof row.settings !== 'object' || Array.isArray(row.settings)) {
    return {};
  }
  return row.settings as Record<string, unknown>;
}

function platformTwilioConfigured(): boolean {
  return !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_WHATSAPP_FROM);
}

function platformRazorpayConfigured(): boolean {
  return !!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

function platformStripeConfigured(): boolean {
  return !!(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
}

function platformMapsConfigured(): boolean {
  return !!env.GOOGLE_MAPS_API_KEY;
}

function platformTallyConfigured(): boolean {
  return !!env.TALLY_LEDGER_MAP;
}

function platformLlmConfigured(): boolean {
  return !!(env.LLM_API_URL && env.LLM_API_KEY);
}

function platformS3Configured(): boolean {
  return !!(env.AWS_S3_BUCKET && env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);
}

function companyTwilioConfigured(s: Record<string, unknown>): boolean {
  return !!(s.accountSid && s.authToken && s.whatsappFrom);
}

function companyRazorpayConfigured(s: Record<string, unknown>): boolean {
  return !!(s.keyId && s.keySecret);
}

function companyStripeConfigured(s: Record<string, unknown>): boolean {
  return !!(s.secretKey && s.webhookSecret);
}

function companyMapsConfigured(s: Record<string, unknown>): boolean {
  return !!s.apiKey;
}

function companyTallyConfigured(s: Record<string, unknown>): boolean {
  return Object.keys(s).length > 0;
}

function companyLlmConfigured(s: Record<string, unknown>): boolean {
  return !!(s.apiUrl && s.apiKey);
}

function companyS3Configured(s: Record<string, unknown>): boolean {
  return !!(s.bucket && s.accessKeyId && s.secretAccessKey);
}

function integrationStatus(
  companySettings: Record<string, unknown>,
  companyCheck: (s: Record<string, unknown>) => boolean,
  platformCheck: () => boolean,
): { configured: boolean; source: IntegrationSource } {
  if (companyCheck(companySettings)) {
    return { configured: true, source: 'company' };
  }
  if (platformCheck()) {
    return { configured: true, source: 'platform' };
  }
  return { configured: false, source: 'none' };
}

export async function getIntegrationsOverview(companyId: string) {
  const rows = await prisma.companyIntegration.findMany({
    where: { companyId },
    select: { provider: true, settings: true, updatedAt: true },
  });
  const byProvider = new Map(rows.map((r) => [r.provider, r]));

  function settingsFor(provider: IntegrationProvider): Record<string, unknown> {
    const row = byProvider.get(provider);
    if (!row?.settings || typeof row.settings !== 'object' || Array.isArray(row.settings)) {
      return {};
    }
    return row.settings as Record<string, unknown>;
  }

  const twilioS = settingsFor('TWILIO');
  const razorpayS = settingsFor('RAZORPAY');
  const stripeS = settingsFor('STRIPE');
  const tallyS = settingsFor('TALLY');
  const mapsS = settingsFor('GOOGLE_MAPS');
  const llmS = settingsFor('LLM');
  const s3S = settingsFor('S3');

  const twilio = integrationStatus(twilioS, companyTwilioConfigured, platformTwilioConfigured);
  const razorpay = integrationStatus(razorpayS, companyRazorpayConfigured, platformRazorpayConfigured);
  const stripe = integrationStatus(stripeS, companyStripeConfigured, platformStripeConfigured);
  const tally = integrationStatus(tallyS, companyTallyConfigured, platformTallyConfigured);
  const maps = integrationStatus(mapsS, companyMapsConfigured, platformMapsConfigured);
  const llm = integrationStatus(llmS, companyLlmConfigured, platformLlmConfigured);
  const s3 = integrationStatus(s3S, companyS3Configured, platformS3Configured);

  return {
    twilio: {
      ...twilio,
      settings: maskSettings({
        accountSid: (twilioS.accountSid as string) ?? env.TWILIO_ACCOUNT_SID ?? '',
        authToken: (twilioS.authToken as string) ?? env.TWILIO_AUTH_TOKEN ?? '',
        whatsappFrom: (twilioS.whatsappFrom as string) ?? env.TWILIO_WHATSAPP_FROM ?? '',
        smsFrom: (twilioS.smsFrom as string) ?? env.TWILIO_SMS_FROM ?? '',
      }),
      webhookUrl: null,
    },
    razorpay: {
      ...razorpay,
      settings: maskSettings({
        keyId: (razorpayS.keyId as string) ?? env.RAZORPAY_KEY_ID ?? '',
        keySecret: (razorpayS.keySecret as string) ?? env.RAZORPAY_KEY_SECRET ?? '',
        webhookSecret: (razorpayS.webhookSecret as string) ?? env.RAZORPAY_WEBHOOK_SECRET ?? '',
      }),
      webhookUrl: `/api/webhooks/razorpay/${companyId}`,
    },
    stripe: {
      ...stripe,
      settings: maskSettings({
        secretKey: (stripeS.secretKey as string) ?? env.STRIPE_SECRET_KEY ?? '',
        webhookSecret: (stripeS.webhookSecret as string) ?? env.STRIPE_WEBHOOK_SECRET ?? '',
      }),
      webhookUrl: `/api/webhooks/stripe/${companyId}`,
    },
    tally: {
      ...tally,
      settings: tallyS,
    },
    maps: {
      ...maps,
      settings: maskSettings({
        apiKey: (mapsS.apiKey as string) ?? env.GOOGLE_MAPS_API_KEY ?? '',
      }),
    },
    llm: {
      ...llm,
      settings: maskSettings({
        apiUrl: (llmS.apiUrl as string) ?? env.LLM_API_URL ?? '',
        apiKey: (llmS.apiKey as string) ?? env.LLM_API_KEY ?? '',
        model: (llmS.model as string) ?? env.LLM_MODEL ?? 'gpt-4o-mini',
      }),
      webhookUrl: null,
    },
    s3: {
      ...s3,
      settings: maskSettings({
        region: (s3S.region as string) ?? env.AWS_REGION ?? 'ap-south-1',
        bucket: (s3S.bucket as string) ?? env.AWS_S3_BUCKET ?? '',
        accessKeyId: (s3S.accessKeyId as string) ?? env.AWS_ACCESS_KEY_ID ?? '',
        secretAccessKey: (s3S.secretAccessKey as string) ?? env.AWS_SECRET_ACCESS_KEY ?? '',
      }),
      webhookUrl: null,
    },
  };
}

export async function upsertIntegration(
  companyId: string,
  userId: string,
  provider: IntegrationProvider,
  incoming: Record<string, unknown>,
): Promise<{ provider: IntegrationProvider; settings: Record<string, unknown> }> {
  const existing = await readCompanySettings(companyId, provider);
  const merged = mergeSettings(existing, incoming);
  const settingsJson = merged as Prisma.InputJsonValue;

  await prisma.companyIntegration.upsert({
    where: { companyId_provider: { companyId, provider } },
    create: {
      companyId,
      provider,
      settings: settingsJson,
      configuredBy: userId,
    },
    update: {
      settings: settingsJson,
      configuredBy: userId,
    },
  });

  return { provider, settings: maskSettings(merged) };
}

export async function resolveTwilioConfig(companyId: string): Promise<TwilioConfig | null> {
  const s = await readCompanySettings(companyId, 'TWILIO');
  if (companyTwilioConfigured(s)) {
    return {
      accountSid: String(s.accountSid),
      authToken: String(s.authToken),
      whatsappFrom: s.whatsappFrom ? String(s.whatsappFrom) : undefined,
      smsFrom: s.smsFrom ? String(s.smsFrom) : undefined,
    };
  }
  if (platformTwilioConfigured()) {
    return {
      accountSid: env.TWILIO_ACCOUNT_SID!,
      authToken: env.TWILIO_AUTH_TOKEN!,
      whatsappFrom: env.TWILIO_WHATSAPP_FROM,
      smsFrom: env.TWILIO_SMS_FROM,
    };
  }
  return null;
}

export async function resolveRazorpayConfig(companyId: string): Promise<RazorpayConfig | null> {
  const s = await readCompanySettings(companyId, 'RAZORPAY');
  if (companyRazorpayConfigured(s)) {
    return {
      keyId: String(s.keyId),
      keySecret: String(s.keySecret),
      // SECURITY (SEC-H7): webhook secret MUST be per-company; never fall back to platform.
      webhookSecret: s.webhookSecret ? String(s.webhookSecret) : undefined,
    };
  }
  if (platformRazorpayConfigured()) {
    return {
      keyId: env.RAZORPAY_KEY_ID!,
      keySecret: env.RAZORPAY_KEY_SECRET!,
      // SECURITY (SEC-H7): do NOT return the platform webhook secret here.
      // The platform secret is reserved for SaaS billing webhooks only.
      // Tenant invoice webhook verification requires a per-company secret;
      // see payment.service.verifyWebhookSignature.
      webhookSecret: undefined,
    };
  }
  return null;
}

export async function resolveStripeConfig(companyId: string): Promise<StripeConfig | null> {
  const s = await readCompanySettings(companyId, 'STRIPE');
  if (companyStripeConfigured(s)) {
    return {
      secretKey: String(s.secretKey),
      webhookSecret: s.webhookSecret ? String(s.webhookSecret) : undefined,
    };
  }
  if (platformStripeConfigured()) {
    return {
      secretKey: env.STRIPE_SECRET_KEY!,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    };
  }
  return null;
}

export async function resolveGoogleMapsConfig(companyId: string): Promise<GoogleMapsConfig | null> {
  const s = await readCompanySettings(companyId, 'GOOGLE_MAPS');
  if (companyMapsConfigured(s)) {
    return { apiKey: String(s.apiKey) };
  }
  if (platformMapsConfigured()) {
    return { apiKey: env.GOOGLE_MAPS_API_KEY! };
  }
  return null;
}

export async function resolveTallyLedgerMap(companyId: string): Promise<TallyLedgerMap> {
  const s = await readCompanySettings(companyId, 'TALLY');
  if (companyTallyConfigured(s)) {
    return s as TallyLedgerMap;
  }
  try {
    if (env.TALLY_LEDGER_MAP) return JSON.parse(env.TALLY_LEDGER_MAP) as TallyLedgerMap;
  } catch {
    // fall through
  }
  return {};
}

export async function resolveLlmConfig(companyId: string): Promise<LlmConfig | null> {
  const s = await readCompanySettings(companyId, 'LLM');
  if (companyLlmConfigured(s)) {
    return {
      apiUrl: String(s.apiUrl),
      apiKey: String(s.apiKey),
      model: s.model ? String(s.model) : env.LLM_MODEL,
    };
  }
  if (platformLlmConfigured()) {
    return {
      apiUrl: env.LLM_API_URL!,
      apiKey: env.LLM_API_KEY!,
      model: env.LLM_MODEL,
    };
  }
  return null;
}

export async function resolveS3Config(companyId: string): Promise<S3Config | null> {
  const s = await readCompanySettings(companyId, 'S3');
  if (companyS3Configured(s)) {
    return {
      region: s.region ? String(s.region) : env.AWS_REGION,
      bucket: String(s.bucket),
      accessKeyId: String(s.accessKeyId),
      secretAccessKey: String(s.secretAccessKey),
    };
  }
  if (platformS3Configured()) {
    return {
      region: env.AWS_REGION,
      bucket: env.AWS_S3_BUCKET,
      accessKeyId: env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
    };
  }
  return null;
}

/** Read-only integration status for platform admin (no secret values). */
export async function getIntegrationsStatusForAdmin(companyId: string) {
  const overview = await getIntegrationsOverview(companyId);
  return {
    twilio: { configured: overview.twilio.configured, source: overview.twilio.source },
    razorpay: { configured: overview.razorpay.configured, source: overview.razorpay.source },
    stripe: { configured: overview.stripe.configured, source: overview.stripe.source },
    tally: { configured: overview.tally.configured, source: overview.tally.source },
    maps: { configured: overview.maps.configured, source: overview.maps.source },
    llm: { configured: overview.llm.configured, source: overview.llm.source },
    s3: { configured: overview.s3.configured, source: overview.s3.source },
  };
}
