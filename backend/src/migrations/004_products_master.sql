-- 004_products_master.sql
-- Creates products master table, variant attributes, product_branch_stock
-- Migrates existing stock_items data

-- 1. Products master table
CREATE TABLE IF NOT EXISTS products (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  business_id INT UNSIGNED NOT NULL,
  sku VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  description TEXT,
  price_customer DECIMAL(12,2) DEFAULT 0.00,
  price_dealer DECIMAL(12,2) DEFAULT 0.00,
  price_staff DECIMAL(12,2) DEFAULT 0.00,
  cost_price DECIMAL(12,2) DEFAULT 0.00,
  min_quantity INT DEFAULT 5,
  status ENUM('available','out_of_stock','discontinued') DEFAULT 'available',
  new_until DATETIME NULL DEFAULT NULL,
  created_by INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE RESTRICT
);

-- 2. Dynamic variant attributes per business
CREATE TABLE IF NOT EXISTS product_variant_attributes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  business_id INT UNSIGNED NOT NULL,
  attribute_key VARCHAR(50) NOT NULL,
  label VARCHAR(100) NOT NULL,
  input_type ENUM('text','select') DEFAULT 'text',
  options JSON NULL,
  sort_order INT DEFAULT 0,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  UNIQUE KEY uq_biz_attr (business_id, attribute_key)
);

-- 3. Variant values per product
CREATE TABLE IF NOT EXISTS product_variant_values (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  attribute_key VARCHAR(50) NOT NULL,
  value VARCHAR(255),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 4. Per-branch stock
CREATE TABLE IF NOT EXISTS product_branch_stock (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  branch_id INT UNSIGNED NOT NULL,
  quantity INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_product_branch (product_id, branch_id)
);

-- 5. Migrate existing stock_items into products + product_branch_stock
-- Each unique item_code in stock_items becomes one products row (using the branch's business_id)
-- Then each stock_items row becomes one product_branch_stock row
INSERT IGNORE INTO products (business_id, sku, name, category, price_customer, price_dealer, price_staff, cost_price, min_quantity, created_at)
SELECT 
  b.business_id,
  si.item_code,
  si.item_name,
  si.category,
  COALESCE(si.selling_price, 0),
  COALESCE(si.price_dealer, 0),
  COALESCE(si.price_staff, 0),
  COALESCE(si.unit_price, 0),
  COALESCE(si.minimum_quantity, 5),
  si.created_at
FROM stock_items si
JOIN branches b ON si.branch_id = b.id;

INSERT IGNORE INTO product_branch_stock (product_id, branch_id, quantity)
SELECT p.id, si.branch_id, si.quantity
FROM stock_items si
JOIN products p ON p.sku = si.item_code;

-- 6. Migrate variant values (colour, model, size) from stock_items
INSERT IGNORE INTO product_variant_values (product_id, attribute_key, value)
SELECT p.id, 'colour', si.variant_color
FROM stock_items si
JOIN products p ON p.sku = si.item_code
WHERE si.variant_color IS NOT NULL AND si.variant_color != '';

INSERT IGNORE INTO product_variant_values (product_id, attribute_key, value)
SELECT p.id, 'model', si.model
FROM stock_items si
JOIN products p ON p.sku = si.item_code
WHERE si.model IS NOT NULL AND si.model != '';

INSERT IGNORE INTO product_variant_values (product_id, attribute_key, value)
SELECT p.id, 'size', si.size
FROM stock_items si
JOIN products p ON p.sku = si.item_code
WHERE si.size IS NOT NULL AND si.size != '';
