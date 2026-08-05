-- Add optional boqItemId to subcontractor material issues
ALTER TABLE "subcontractor_material_issues" ADD COLUMN "boq_item_id" UUID REFERENCES "boq_items"("id") ON DELETE SET NULL;