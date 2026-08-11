-- Inventory: link auto draft sales invoices to stock issue movements

ALTER TABLE "invoices" ADD COLUMN "stock_movement_id" UUID;

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_stock_movement_id_fkey"
  FOREIGN KEY ("stock_movement_id") REFERENCES "stock_movements"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "invoices_stock_movement_id_key" ON "invoices"("stock_movement_id");
