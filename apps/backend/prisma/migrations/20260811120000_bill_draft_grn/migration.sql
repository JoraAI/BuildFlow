-- Inventory auto-draft bills: BillStatus.DRAFT + optional Bill.goods_receipt_id

ALTER TYPE "BillStatus" ADD VALUE 'DRAFT';

ALTER TABLE "bills" ADD COLUMN "goods_receipt_id" UUID;

ALTER TABLE "bills"
  ADD CONSTRAINT "bills_goods_receipt_id_fkey"
  FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipt_notes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "bills_goods_receipt_id_key" ON "bills"("goods_receipt_id");
