-- AlterTable
ALTER TABLE "companies" ADD COLUMN "subscription_plan" TEXT NOT NULL DEFAULT 'STARTER';
ALTER TABLE "companies" ADD COLUMN "subscription_status" TEXT NOT NULL DEFAULT 'TRIAL';
ALTER TABLE "companies" ADD COLUMN "trial_starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "companies" ADD COLUMN "trial_ends_at" TIMESTAMP(3);

-- Backfill trial end for existing companies (14-day trial from created_at)
UPDATE "companies"
SET "trial_ends_at" = "created_at" + INTERVAL '14 days'
WHERE "trial_ends_at" IS NULL;
