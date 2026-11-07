-- AlterEnum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'AUDITOR';

CREATE TYPE "GstHandoffStatus" AS ENUM ('DRAFT', 'SENT', 'IN_PROGRESS', 'FILED');
CREATE TYPE "AuditorManualEntryType" AS ENUM ('JOURNAL', 'BANK_NOTE', 'GST_NOTE');

CREATE TABLE "auditor_memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "invited_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "auditor_memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gst_handoff_packs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "label" TEXT NOT NULL,
    "status" "GstHandoffStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "sent_at" TIMESTAMP(3),
    "sent_by_id" UUID,
    "filed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "gst_handoff_packs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auditor_manual_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pack_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "entry_type" "AuditorManualEntryType" NOT NULL,
    "entry_date" DATE NOT NULL,
    "amount" DECIMAL(14,2),
    "narration" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "auditor_manual_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auditor_memberships_user_id_company_id_key" ON "auditor_memberships"("user_id", "company_id");
CREATE INDEX "auditor_memberships_company_id_is_active_idx" ON "auditor_memberships"("company_id", "is_active");
CREATE INDEX "gst_handoff_packs_company_id_status_idx" ON "gst_handoff_packs"("company_id", "status");
CREATE INDEX "gst_handoff_packs_company_id_period_start_period_end_idx" ON "gst_handoff_packs"("company_id", "period_start", "period_end");
CREATE INDEX "auditor_manual_entries_pack_id_idx" ON "auditor_manual_entries"("pack_id");
CREATE INDEX "auditor_manual_entries_company_id_idx" ON "auditor_manual_entries"("company_id");

ALTER TABLE "auditor_memberships" ADD CONSTRAINT "auditor_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auditor_memberships" ADD CONSTRAINT "auditor_memberships_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gst_handoff_packs" ADD CONSTRAINT "gst_handoff_packs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gst_handoff_packs" ADD CONSTRAINT "gst_handoff_packs_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "auditor_manual_entries" ADD CONSTRAINT "auditor_manual_entries_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "gst_handoff_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auditor_manual_entries" ADD CONSTRAINT "auditor_manual_entries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auditor_manual_entries" ADD CONSTRAINT "auditor_manual_entries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
