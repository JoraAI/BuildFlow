-- Shop verticals → capability lanes:
--   GENERAL ← KIRANA (+ former classification-only verticals)
--   EVENTS  ← LIGHTING
ALTER TYPE "InventoryVertical" RENAME TO "InventoryVertical_old";
CREATE TYPE "InventoryVertical" AS ENUM ('GENERAL', 'EVENTS');

ALTER TABLE "companies"
  ALTER COLUMN "inventory_vertical" TYPE "InventoryVertical"
  USING (
    CASE "inventory_vertical"::text
      WHEN 'KIRANA' THEN 'GENERAL'::"InventoryVertical"
      WHEN 'PHARMACY' THEN 'GENERAL'::"InventoryVertical"
      WHEN 'ELECTRONICS' THEN 'GENERAL'::"InventoryVertical"
      WHEN 'STATIONERY' THEN 'GENERAL'::"InventoryVertical"
      WHEN 'HARDWARE' THEN 'GENERAL'::"InventoryVertical"
      WHEN 'GENERAL' THEN 'GENERAL'::"InventoryVertical"
      WHEN 'LIGHTING' THEN 'EVENTS'::"InventoryVertical"
      WHEN 'EVENTS' THEN 'EVENTS'::"InventoryVertical"
      ELSE NULL
    END
  );

DROP TYPE "InventoryVertical_old";
