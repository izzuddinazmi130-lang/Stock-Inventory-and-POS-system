CREATE DATABASE IF NOT EXISTS hq_inventory
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE hq_inventory;

CREATE TABLE IF NOT EXISTS warehouses (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role ENUM('super_admin', 'admin_kaftanasia', 'admin_astech') NOT NULL,
    assigned_warehouse_id INT UNSIGNED NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    last_login DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_warehouse FOREIGN KEY (assigned_warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS master_products (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NULL UNIQUE,
    description TEXT NULL,
    category VARCHAR(100) NOT NULL,
    brand VARCHAR(100) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS product_variants (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    master_product_id INT UNSIGNED NOT NULL,
    warehouse_id INT UNSIGNED NOT NULL,
    variant_name VARCHAR(255) NOT NULL,
    variant_sku VARCHAR(100) NOT NULL UNIQUE,
    price DECIMAL(12,2) NOT NULL DEFAULT 0,
    cost DECIMAL(12,2) NULL,
    size VARCHAR(50) NULL,
    color VARCHAR(100) NULL,
    weight DECIMAL(10,2) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_variants_product FOREIGN KEY (master_product_id) REFERENCES master_products(id) ON DELETE CASCADE,
    CONSTRAINT fk_variants_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inventory (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_variant_id INT UNSIGNED NOT NULL,
    warehouse_id INT UNSIGNED NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    reserved_quantity INT NOT NULL DEFAULT 0,
    minimum_quantity INT NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_inventory_variant_warehouse (product_variant_id, warehouse_id),
    CONSTRAINT fk_inventory_variant FOREIGN KEY (product_variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
    CONSTRAINT fk_inventory_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stock_thresholds (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_variant_id INT UNSIGNED NOT NULL,
    warehouse_id INT UNSIGNED NOT NULL,
    critical_level INT NOT NULL DEFAULT 2,
    low_level INT NOT NULL DEFAULT 10,
    overstock_level INT NOT NULL DEFAULT 100,
    UNIQUE KEY uq_threshold_variant_warehouse (product_variant_id, warehouse_id),
    CONSTRAINT fk_thresholds_variant FOREIGN KEY (product_variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
    CONSTRAINT fk_thresholds_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inventory_transactions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_variant_id INT UNSIGNED NOT NULL,
    warehouse_id INT UNSIGNED NOT NULL,
    transaction_type ENUM('STOCK_IN', 'STOCK_OUT', 'RETURN', 'DAMAGE') NOT NULL,
    old_quantity INT NOT NULL DEFAULT 0,
    quantity_changed INT NOT NULL,
    new_quantity INT NOT NULL DEFAULT 0,
    reference_id VARCHAR(100) NULL,
    reason TEXT NULL,
    performed_by INT UNSIGNED NOT NULL,
    qr_scanned TINYINT(1) NOT NULL DEFAULT 0,
    qr_code VARCHAR(255) NULL,
    physical_store_location VARCHAR(150) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_transactions_variant FOREIGN KEY (product_variant_id) REFERENCES product_variants(id),
    CONSTRAINT fk_transactions_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    CONSTRAINT fk_transactions_user FOREIGN KEY (performed_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS qr_codes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_variant_id INT UNSIGNED NOT NULL,
    warehouse_id INT UNSIGNED NOT NULL,
    qr_code VARCHAR(255) NOT NULL UNIQUE,
    qr_image_path VARCHAR(500) NULL,
    generated_by INT UNSIGNED NOT NULL,
    generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_scanned_at DATETIME NULL,
    scan_count INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    CONSTRAINT fk_qr_variant FOREIGN KEY (product_variant_id) REFERENCES product_variants(id),
    CONSTRAINT fk_qr_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    CONSTRAINT fk_qr_user FOREIGN KEY (generated_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stock_status_log (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_variant_id INT UNSIGNED NOT NULL,
    warehouse_id INT UNSIGNED NOT NULL,
    status ENUM('critical', 'low', 'normal', 'overstock') NOT NULL,
    previous_status VARCHAR(20) NULL,
    quantity_at_check INT NOT NULL,
    threshold_low INT NOT NULL,
    threshold_critical INT NOT NULL,
    checked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_status_variant FOREIGN KEY (product_variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
    CONSTRAINT fk_status_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NULL,
    entity_id INT UNSIGNED NULL,
    old_values JSON NULL,
    new_values JSON NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT INTO warehouses (id, name, is_active) VALUES
    (1, 'Kaftanasia', 1),
    (2, 'Astech', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = VALUES(is_active);

INSERT INTO users (email, password_hash, full_name, role, assigned_warehouse_id, is_active) VALUES
    ('admin@example.com', '$2y$12$nmIRd4NS.PfsHFBG2nPPW.wPiA.Y/TRog5VtxTQ5QZ6MUoO9bKvvy', 'Super Administrator', 'super_admin', NULL, 1),
    ('kaftanasia@example.com', '$2y$12$nmIRd4NS.PfsHFBG2nPPW.wPiA.Y/TRog5VtxTQ5QZ6MUoO9bKvvy', 'Kaftanasia Administrator', 'admin_kaftanasia', 1, 1),
    ('astech@example.com', '$2y$12$nmIRd4NS.PfsHFBG2nPPW.wPiA.Y/TRog5VtxTQ5QZ6MUoO9bKvvy', 'Astech Administrator', 'admin_astech', 2, 1)
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), role = VALUES(role), assigned_warehouse_id = VALUES(assigned_warehouse_id), is_active = VALUES(is_active);
