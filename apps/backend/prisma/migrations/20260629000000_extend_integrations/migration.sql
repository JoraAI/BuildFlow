-- Extend integration providers (LLM BYOK, per-tenant S3) + SaaS billing fields on Company
ALTER TYPE "IntegrationProvider" ADD VALUE 'LLM';
ALTER TYPE "IntegrationProvider" ADD VALUE 'S3';

ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "last_payment_at" TIMESTAMP(3);
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "saas_payment_ref" TEXT;
