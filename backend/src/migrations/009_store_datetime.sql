-- Migration 009: Store Datetime Support
ALTER TABLE stores 
  MODIFY COLUMN start_date DATETIME NULL,
  MODIFY COLUMN end_date DATETIME NULL;

UPDATE stores
SET end_date = DATE_ADD(DATE(end_date), INTERVAL '23:59:59' HOUR_SECOND)
WHERE end_date IS NOT NULL AND TIME(end_date) = '00:00:00';
