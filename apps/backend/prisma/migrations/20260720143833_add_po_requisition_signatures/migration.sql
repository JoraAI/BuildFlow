-- AlterTable
ALTER TABLE "material_requisitions" ADD COLUMN     "signature_hash" TEXT,
ADD COLUMN     "signed_at" TIMESTAMP(3),
ADD COLUMN     "signed_by" UUID,
ADD COLUMN     "signed_by_name" TEXT;

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "delivery_date" DATE,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "payment_terms" TEXT,
ADD COLUMN     "signature_hash" TEXT,
ADD COLUMN     "signed_at" TIMESTAMP(3),
ADD COLUMN     "signed_by" UUID,
ADD COLUMN     "signed_by_name" TEXT,
ADD COLUMN     "vendor_address" TEXT,
ADD COLUMN     "vendor_gstin" TEXT;
