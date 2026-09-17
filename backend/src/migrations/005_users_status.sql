-- 005_users_status.sql

ALTER TABLE users 
  ADD COLUMN status ENUM('pending','active','suspended','declined') NOT NULL DEFAULT 'pending' AFTER is_active,
  ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL;

UPDATE users SET status = CASE 
  WHEN is_active = 0 THEN 'pending'
  WHEN is_active = 1 THEN 'active'
  WHEN is_active = 2 THEN 'declined'
  ELSE 'pending'
END;
