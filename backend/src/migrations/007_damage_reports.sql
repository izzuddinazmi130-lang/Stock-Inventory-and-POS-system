-- 007_damage_reports.sql
-- Create damage_reports and damage_report_photos tables with proper INT UNSIGNED FKs

CREATE TABLE IF NOT EXISTS damage_reports (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  business_id INT UNSIGNED NOT NULL,
  branch_id INT UNSIGNED NOT NULL,
  quantity INT NOT NULL,
  cost_per_unit DECIMAL(12,2) NOT NULL,
  total_value DECIMAL(12,2) NOT NULL,
  reason_category ENUM('transit_damage','breakage','water_damage','expired','manufacturing_defect','other') NOT NULL,
  reason_details TEXT,
  reported_by INT UNSIGNED NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE RESTRICT,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS damage_report_photos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  damage_report_id INT UNSIGNED NOT NULL,
  photo_path VARCHAR(255) NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (damage_report_id) REFERENCES damage_reports(id) ON DELETE CASCADE
);
