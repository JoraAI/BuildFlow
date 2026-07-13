-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'DPM';
ALTER TYPE "Role" ADD VALUE 'QC';
ALTER TYPE "Role" ADD VALUE 'MECHANICAL_MANAGER';
ALTER TYPE "Role" ADD VALUE 'STORE_INCHARGE';
ALTER TYPE "Role" ADD VALUE 'WEIGHBRIDGE_INCHARGE';
ALTER TYPE "Role" ADD VALUE 'SITE_SUPERVISOR';

-- AlterTable
ALTER TABLE "boq_measurements" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "daily_report_task_updates" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "company_role_permissions" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_customized" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_role_permissions_company_id_idx" ON "company_role_permissions"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_role_permissions_company_id_role_key" ON "company_role_permissions"("company_id", "role");

-- AddForeignKey
ALTER TABLE "company_role_permissions" ADD CONSTRAINT "company_role_permissions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "regional_material_rates_region_id_resource_id_effective_date_ke" RENAME TO "regional_material_rates_region_id_resource_id_effective_dat_key";
