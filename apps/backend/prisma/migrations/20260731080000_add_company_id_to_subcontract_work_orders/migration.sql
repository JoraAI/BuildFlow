-- DAT-3.6: Add company_id to subcontract_work_orders for tenant isolation.
ALTER TABLE "subcontract_work_orders" ADD COLUMN "company_id" UUID;

-- Backfill from the project's company_id
UPDATE "subcontract_work_orders" swo
SET "company_id" = p."company_id"
FROM "projects" p
WHERE swo."project_id" = p."id";

-- Now make it NOT NULL + add FK + index
ALTER TABLE "subcontract_work_orders" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "subcontract_work_orders" ADD CONSTRAINT "subcontract_work_orders_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "subcontract_work_orders_company_id_idx" ON "subcontract_work_orders"("company_id");
