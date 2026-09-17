-- ============================================================
-- Migration 002: Business → Branch → Store Hierarchy
-- ============================================================

-- 1. Create businesses table
CREATE TABLE IF NOT EXISTS businesses (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Create branches table
CREATE TABLE IF NOT EXISTS branches (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  business_id INT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  address TEXT NULL,
  city VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_branch_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. Create stores table (physical sales events under a branch)
CREATE TABLE IF NOT EXISTS stores (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  branch_id INT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  status ENUM('upcoming','active','ended') NOT NULL DEFAULT 'upcoming',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME NULL,
  CONSTRAINT fk_store_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. Migration data: map existing warehouses to businesses + branches
-- (These correspond to existing live warehouses, not seed data)
INSERT IGNORE INTO businesses (id, name, description) VALUES
  (1, 'Kaftanasia', 'Clothing and fashion boutique business'),
  (2, 'As Tech', 'Computer hardware and technology business');

INSERT IGNORE INTO branches (id, business_id, name, address, city) VALUES
  (1, 1, 'Kaftanasia Main Branch', NULL, NULL),
  (2, 2, 'As Tech Main Branch', NULL, NULL);

-- 5. Add business_id and branch_id to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS business_id INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS branch_id INT UNSIGNED NULL;

-- 6. Add 'admin' to the role ENUM (keep old values temporarily for safe UPDATE)
ALTER TABLE users MODIFY COLUMN role ENUM('super_admin','admin_kaftanasia','admin_astech','admin') NOT NULL DEFAULT 'admin';

-- 7. Set business_id + branch_id for existing admins
UPDATE users SET business_id = 1, branch_id = 1, role = 'admin' WHERE role = 'admin_kaftanasia';
UPDATE users SET business_id = 2, branch_id = 2, role = 'admin' WHERE role = 'admin_astech';

-- 8. Now safely drop old role values
ALTER TABLE users MODIFY COLUMN role ENUM('super_admin','admin') NOT NULL;

-- 9. Add branch_id, store_id columns to stock_items
ALTER TABLE stock_items
  ADD COLUMN IF NOT EXISTS branch_id INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS store_id INT UNSIGNED NULL;

-- 10. Auto-map stock_items: warehouse_id → branch_id
UPDATE stock_items SET branch_id = warehouse_id WHERE branch_id IS NULL;

-- 11. Add branch_id, store_id, payment_method to stock_movements
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS branch_id INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS store_id INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS payment_method ENUM('cash','qr','online_banking') NULL;

-- 12. Auto-map stock_movements: warehouse_id → branch_id
UPDATE stock_movements SET branch_id = warehouse_id WHERE branch_id IS NULL;
