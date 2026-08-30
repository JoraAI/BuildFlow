-- INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.1): Kirana vertical + starter catalog.
-- Nullable Company columns only - construction + non-Kirana inventory tenants are
-- untouched. The vertical is set once by applyCatalogTemplate (insert-missing only).

CREATE TYPE "InventoryVertical" AS ENUM ('KIRANA');

ALTER TABLE "companies"
    ADD COLUMN "inventory_vertical" "InventoryVertical",
    ADD COLUMN "catalog_seeded_at" TIMESTAMP(3);



