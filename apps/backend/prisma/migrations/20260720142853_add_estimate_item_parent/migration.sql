-- AlterTable
ALTER TABLE "estimate_items" ADD COLUMN     "parent_id" UUID;

-- CreateIndex
CREATE INDEX "estimate_items_parent_id_idx" ON "estimate_items"("parent_id");

-- AddForeignKey
ALTER TABLE "estimate_items" ADD CONSTRAINT "estimate_items_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "estimate_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
