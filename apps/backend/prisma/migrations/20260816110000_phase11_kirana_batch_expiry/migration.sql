-- INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.2): batch / expiry / FEFO.
-- Resource.trackingMode NONE|BATCH_EXPIRY + per-lot StockBatchBalance table.
-- Aggregate StockBalance stays the single analytics/construction key (K6).
-- Construction + untracked inventory keep tracking_mode 'NONE' — no mandatory
-- batch/expiry anywhere outside batch-tracked Kirana items.

CREATE TYPE "ResourceTrackingMode" AS ENUM ('NONE', 'BATCH_EXPIRY');

ALTER TABLE "resources"
    ADD COLUMN "tracking_mode" "ResourceTrackingMode" NOT NULL DEFAULT 'NONE';

CREATE TABLE "stock_batch_balances" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "batch_code" TEXT NOT NULL,
    "manufactured_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "quantity" DECIMAL(12,3) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_batch_balances_pkey" PRIMARY KEY ("id")
);

-- Receipt lot dates (11.2.5) — audit + batch copy source for GRN lines.
ALTER TABLE "goods_receipt_lines"
    ADD COLUMN "manufactured_at" TIMESTAMP(3),
    ADD COLUMN "expires_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "stock_batch_balances_locationId_resourceId_batchCode_key"
    ON "stock_batch_balances"("location_id", "resource_id", "batch_code");
CREATE INDEX "stock_batch_balances_resourceId_expiresAt_idx"
    ON "stock_batch_balances"("resource_id", "expires_at");
CREATE INDEX "stock_batch_balances_locationId_expiresAt_idx"
    ON "stock_batch_balances"("location_id", "expires_at");

ALTER TABLE "stock_batch_balances"
    ADD CONSTRAINT "stock_batch_balances_location_id_fkey" FOREIGN KEY ("location_id")
        REFERENCES "stock_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_batch_balances"
    ADD CONSTRAINT "stock_batch_balances_resource_id_fkey" FOREIGN KEY ("resource_id")
        REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 11.2.3 LEGACY backfill: any pre-existing aggregate balance on an already
-- batch-tracked resource becomes one null-dated LEGACY lot (quantity preserved)
-- so dual-write consistency holds from day one. No rows today (tracking_mode
-- defaults NONE); this is the safety net for enable-then-migrate ordering.
INSERT INTO "stock_batch_balances"
    ("id", "location_id", "resource_id", "batch_code", "manufactured_at", "expires_at", "quantity", "received_at")
SELECT gen_random_uuid(), sb."location_id", sb."resource_id", 'LEGACY', NULL, NULL, sb."quantity", CURRENT_TIMESTAMP
FROM "stock_balances" sb
JOIN "resources" r ON r."id" = sb."resource_id"
WHERE r."tracking_mode" = 'BATCH_EXPIRY' AND sb."quantity" > 0
ON CONFLICT ("location_id", "resource_id", "batch_code") DO NOTHING;
