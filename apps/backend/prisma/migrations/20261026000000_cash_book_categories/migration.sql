-- Company-defined cash book expense categories (presets are seeded per company).
CREATE TABLE "inventory_cash_book_categories" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_preset" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_cash_book_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inventory_cash_book_categories_company_id_slug_key"
    ON "inventory_cash_book_categories"("company_id", "slug");

CREATE INDEX "inventory_cash_book_categories_company_id_idx"
    ON "inventory_cash_book_categories"("company_id");

ALTER TABLE "inventory_cash_book_categories"
    ADD CONSTRAINT "inventory_cash_book_categories_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_cash_book_categories"
    ADD CONSTRAINT "inventory_cash_book_categories_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON UPDATE CASCADE;
