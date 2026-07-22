-- CreateTable
CREATE TABLE "subcontractor_material_issues" (
    "id" UUID NOT NULL,
    "work_order_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "issue_date" DATE NOT NULL,
    "issued_by" UUID NOT NULL,
    "notes" TEXT,
    "recovered_qty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "recovered_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subcontractor_material_issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subcontractor_material_issues_work_order_id_idx" ON "subcontractor_material_issues"("work_order_id");

-- CreateIndex
CREATE INDEX "subcontractor_material_issues_resource_id_idx" ON "subcontractor_material_issues"("resource_id");

-- AddForeignKey
ALTER TABLE "subcontractor_material_issues" ADD CONSTRAINT "subcontractor_material_issues_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "subcontract_work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcontractor_material_issues" ADD CONSTRAINT "subcontractor_material_issues_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcontractor_material_issues" ADD CONSTRAINT "subcontractor_material_issues_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
