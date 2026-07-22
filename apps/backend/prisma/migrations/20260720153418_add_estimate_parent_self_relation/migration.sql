-- AlterTable
ALTER TABLE "estimates" ADD COLUMN     "parent_id" UUID;

-- CreateIndex
CREATE INDEX "estimates_parent_id_idx" ON "estimates"("parent_id");

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
