-- CreateEnum
CREATE TYPE "AuditorPackCadence" AS ENUM ('MONTHLY', 'QUARTERLY');

-- AlterTable
ALTER TABLE "companies"
  ADD COLUMN "auditor_pack_cadence" "AuditorPackCadence" NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN "auditor_pack_day" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "gst_handoff_packs" ADD COLUMN "snapshot" JSONB;
