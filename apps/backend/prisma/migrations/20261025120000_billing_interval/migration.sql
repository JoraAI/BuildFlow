-- AlterEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN "billing_interval" "BillingInterval",
ADD COLUMN "pending_billing_interval" "BillingInterval";
