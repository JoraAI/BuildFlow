-- GENERAL→RETAILER, EVENTS→WHOLESALER, ICE_CREAM→MANUFACTURER
ALTER TYPE "InventoryVertical" RENAME TO "InventoryVertical_old";
CREATE TYPE "InventoryVertical" AS ENUM ('RETAILER', 'WHOLESALER', 'MANUFACTURER');

ALTER TABLE "companies"
  ALTER COLUMN "inventory_vertical" TYPE "InventoryVertical"
  USING (
    CASE "inventory_vertical"::text
      WHEN 'GENERAL' THEN 'RETAILER'::"InventoryVertical"
      WHEN 'RETAILER' THEN 'RETAILER'::"InventoryVertical"
      WHEN 'EVENTS' THEN 'WHOLESALER'::"InventoryVertical"
      WHEN 'WHOLESALER' THEN 'WHOLESALER'::"InventoryVertical"
      WHEN 'ICE_CREAM' THEN 'MANUFACTURER'::"InventoryVertical"
      WHEN 'MANUFACTURER' THEN 'MANUFACTURER'::"InventoryVertical"
      ELSE NULL
    END
  );

DROP TYPE "InventoryVertical_old";
