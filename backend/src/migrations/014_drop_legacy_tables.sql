-- 014: Remove tables the system no longer uses.
--
--   system_settings              never read or written by the app (left over from the PHP version)
--   product_variant_attributes   empty; replaced by business_form_fields
--   stock_items                  old product table; replaced by products + product_branch_stock
--   stock_returns_damage         empty; replaced by damage_reports
--
-- No other table has a foreign key to these, and the backend no longer references them.
-- Back up the database before running this (phpMyAdmin > Export).

START TRANSACTION;

DROP TABLE IF EXISTS `system_settings`;
DROP TABLE IF EXISTS `product_variant_attributes`;
DROP TABLE IF EXISTS `stock_returns_damage`;
DROP TABLE IF EXISTS `stock_items`;

COMMIT;
