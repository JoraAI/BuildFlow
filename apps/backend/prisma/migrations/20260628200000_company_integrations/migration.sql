-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('TWILIO', 'RAZORPAY', 'STRIPE', 'TALLY', 'GOOGLE_MAPS');

-- AlterEnum
ALTER TYPE "TicketCategory" ADD VALUE 'INTEGRATION_SETUP';

-- CreateTable
CREATE TABLE "company_integrations" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "configured_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_integrations_company_id_provider_key" ON "company_integrations"("company_id", "provider");

-- AddForeignKey
ALTER TABLE "company_integrations" ADD CONSTRAINT "company_integrations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
