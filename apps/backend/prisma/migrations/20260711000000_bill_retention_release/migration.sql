-- Bill retention release flag
ALTER TABLE "bills" ADD COLUMN "is_retention_release" BOOLEAN NOT NULL DEFAULT false;

-- WO retention release timestamp
ALTER TABLE "subcontract_work_orders" ADD COLUMN "retention_released_at" TIMESTAMP(3);
