-- Migration 011: Variant-specific SKU format
-- Adds a previous_sku column so the SKU regeneration in run_011.js is
-- traceable (and reversible if something goes wrong). The actual SKU
-- regeneration is done in JS (run_011.js) because it needs the slugify /
-- uniqueness logic shared with backend/src/routes/products.js.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS previous_sku VARCHAR(50) NULL AFTER sku;