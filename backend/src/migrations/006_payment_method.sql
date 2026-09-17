-- 006_payment_method.sql
-- Add payment_method to stock_movements for store report breakdown
-- Compatible with MySQL 5.7+ via dynamic SQL guard

SET @exists = (
  SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = DATABASE()
    AND table_name = 'stock_movements'
    AND column_name = 'payment_method'
);

SET @sql = IF(
  @exists = 0,
  'ALTER TABLE stock_movements ADD COLUMN payment_method ENUM(''cash'',''qr'',''online_banking'') NULL DEFAULT NULL',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
