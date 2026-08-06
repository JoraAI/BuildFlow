/**
 * BuildFlow - Environment configuration (Zod-validated)
 */
import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

// Monorepo: .env lives at the repo root, but the backend process CWD is
// apps/backend. Walk up from CWD until we find a .env file.
function findEnvPath(): string | undefined {
  let dir = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    const candidate = resolve(dir, '.env');
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

dotenv.config({ path: findEnvPath() });

/** Accept redis:// and rediss:// (Upstash TLS). Zod .url() rejects rediss://. */
const redisUrlSchema = z
  .string()
  .min(1)
  .refine((v) => /^rediss?:\/\/.+/i.test(v.trim()), {
    message: 'Must be a redis:// or rediss:// URL (use Upstash "Redis" tab, not REST URL)',
  });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),

  DATABASE_URL: z.string().url(),

  REDIS_URL: redisUrlSchema.default('redis://localhost:6379'),

  // FIX (SEC-L16): Require ≥32-char JWT secrets in production; reject placeholders.
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_COST: z.coerce.number().int().min(8).max(15).default(12),

  CORS_ORIGIN: z.string().default('http://localhost:8081'),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().default(10),
  RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().int().default(900000),
  RATE_LIMIT_API_MAX: z.coerce.number().int().default(200),
  RATE_LIMIT_API_WINDOW_MS: z.coerce.number().int().default(60000),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'verbose']).default('info'),

  // AWS S3 (file storage)
  AWS_REGION: z.string().default('ap-south-1'),
  AWS_S3_BUCKET: z.string().default('buildflow-dev'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PRESIGN_EXPIRY_SECONDS: z.coerce.number().int().min(60).max(3600).default(900), // 15 min

  // ── Encrypted File Storage abstraction ───────────────────────────
  // Provider: 'local' | 's3' | 'drive'. Switching is a one-line env change.
  // Encrypted bytes are stored at the provider; ciphertext is provider-agnostic.
  FILE_STORAGE_PROVIDER: z.enum(['local', 's3', 'drive']).default('local'),

  // Master key for AES-256-GCM field/file encryption. Must be 32 bytes
  // base64-encoded (generate with: openssl rand -base64 32). Per-company
  // data keys are HKDF-derived from this master so rotation is centralized.
  // When omitted in non-production, a deterministic dev key is used.
  FILE_ENCRYPTION_MASTER_KEY: z
    .preprocess((v) => (v === '' ? undefined : v), z.string().optional()),

  // Local storage (dev / tests)
  FILE_STORAGE_LOCAL_DIR: z.string().default('./.filestore'),

  // Google Drive storage (cheap encrypted file store, swappable to S3/R2/etc later)
  DRIVE_CLIENT_EMAIL: z
    .preprocess((v) => (v === '' ? undefined : v), z.string().email().optional()),
  DRIVE_PRIVATE_KEY: z
    .preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  DRIVE_ROOT_FOLDER_ID: z
    .preprocess((v) => (v === '' ? undefined : v), z.string().optional()),

  // Tally Prime export (optional ledger name mapping JSON)
  TALLY_LEDGER_MAP: z.string().optional(),

  // Twilio (WhatsApp + SMS) - optional
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  TWILIO_SMS_FROM: z.string().optional(),

  // Razorpay - optional
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // Stripe (optional, for international payments)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Google Maps Platform - optional
  GOOGLE_MAPS_API_KEY: z.string().optional(),

  // Chatbot LLM proxy - optional (OpenAI-compatible endpoint)
  // Treat empty string as undefined (common .env quirk)
  LLM_API_URL: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),
  LLM_API_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  LLM_MODEL: z.string().default('gpt-4o-mini'),

  // Expo push notifications - optional
  EXPO_ACCESS_TOKEN: z.string().optional(),

  // Auth / onboarding
  ALLOW_PUBLIC_COMPANY_REGISTRATION: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  INVITE_TOKEN_EXPIRES_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  APP_PUBLIC_URL: z.string().url().default('http://localhost:8081'),

  // Internal ops alerts (new trials, expiring subscriptions)
  INTERNAL_OPS_EMAIL: z.preprocess((v) => (v === '' ? undefined : v), z.string().email().optional()),
  INTERNAL_OPS_WEBHOOK_URL: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),

  // Trial length in days for new company registrations
  TRIAL_DAYS: z.coerce.number().int().min(1).max(90).default(14),

  // BuildFlow SaaS billing (platform-owned - charges companies for subscriptions)
  SAAS_RAZORPAY_KEY_ID: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  SAAS_RAZORPAY_KEY_SECRET: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  SAAS_RAZORPAY_WEBHOOK_SECRET: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  SAAS_STRIPE_SECRET_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  SAAS_STRIPE_WEBHOOK_SECRET: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration. Check your .env file.');
}

export const env = parsed.data;
export type Env = typeof env;