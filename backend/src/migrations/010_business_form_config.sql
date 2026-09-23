-- Migration 010: Configurable business product forms

CREATE TABLE IF NOT EXISTS business_form_categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  business_id INT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_form_category_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  UNIQUE KEY uq_form_category_name (business_id, name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS business_form_fields (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  business_id INT UNSIGNED NOT NULL,
  attribute_key VARCHAR(50) NOT NULL,
  label VARCHAR(100) NOT NULL,
  input_type ENUM('text', 'select') NOT NULL DEFAULT 'text',
  options JSON NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_form_field_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  UNIQUE KEY uq_form_field_key (business_id, attribute_key),
  UNIQUE KEY uq_form_field_label (business_id, label)
) ENGINE=InnoDB;

-- Normalize known legacy values without changing the business identity.
UPDATE businesses
SET industry = CASE
  WHEN LOWER(COALESCE(industry, '')) LIKE '%fashion%'
    OR LOWER(COALESCE(industry, '')) LIKE '%cloth%'
    OR LOWER(COALESCE(industry, '')) LIKE '%apparel%'
    OR LOWER(COALESCE(industry, '')) LIKE '%kaftan%'
    OR LOWER(COALESCE(industry, '')) LIKE '%retail%' THEN 'fashion'
  WHEN LOWER(COALESCE(industry, '')) LIKE '%tech%'
    OR LOWER(COALESCE(industry, '')) LIKE '%computer%'
    OR LOWER(COALESCE(industry, '')) LIKE '%electronic%'
    OR LOWER(COALESCE(industry, '')) LIKE '%hardware%'
    OR LOWER(COALESCE(industry, '')) LIKE '%gadget%' THEN 'technology'
  ELSE 'general'
END;

INSERT IGNORE INTO business_form_categories (business_id, name, sort_order)
SELECT b.id, c.name, c.sort_order
FROM businesses b
JOIN (
  SELECT 'Kaftanasia' AS business_name, 'Abaya' AS name, 10 AS sort_order UNION ALL
  SELECT 'Kaftanasia', 'Kaftan', 20 UNION ALL
  SELECT 'Kaftanasia', 'Jubah', 30 UNION ALL
  SELECT 'Kaftanasia', 'Blouse', 40 UNION ALL
  SELECT 'Kaftanasia', 'Dress', 50 UNION ALL
  SELECT 'Kaftanasia', 'Scarf', 60 UNION ALL
  SELECT 'Kaftanasia', 'Accessories', 70 UNION ALL
  SELECT 'Kaftanasia', 'Other', 80 UNION ALL
  SELECT 'As Tech', 'Keyboard', 10 UNION ALL
  SELECT 'As Tech', 'Mouse', 20 UNION ALL
  SELECT 'As Tech', 'Monitor', 30 UNION ALL
  SELECT 'As Tech', 'CPU', 40 UNION ALL
  SELECT 'As Tech', 'RAM', 50 UNION ALL
  SELECT 'As Tech', 'SSD', 60 UNION ALL
  SELECT 'As Tech', 'HDD', 70 UNION ALL
  SELECT 'As Tech', 'Laptop', 80 UNION ALL
  SELECT 'As Tech', 'Headset', 90 UNION ALL
  SELECT 'As Tech', 'Accessories', 100 UNION ALL
  SELECT 'As Tech', 'Other', 110
) c ON c.business_name = b.name;

INSERT IGNORE INTO business_form_fields (business_id, attribute_key, label, input_type, options, sort_order)
SELECT b.id, f.attribute_key, f.label, f.input_type, f.options, f.sort_order
FROM businesses b
JOIN (
  SELECT 'Kaftanasia' AS business_name, 'colour' AS attribute_key, 'Colour / Variant' AS label, 'text' AS input_type, NULL AS options, 10 AS sort_order UNION ALL
  SELECT 'Kaftanasia', 'size', 'Size', 'select', JSON_ARRAY('XS','S','M','L','XL','XXL','XXXL','Free Size','Custom'), 20 UNION ALL
  SELECT 'Kaftanasia', 'model', 'Style / Model', 'text', NULL, 30 UNION ALL
  SELECT 'As Tech', 'model', 'Model / Part Number', 'text', NULL, 10
) f ON f.business_name = b.name;

-- Preserve any custom attributes already created in the legacy table.
INSERT IGNORE INTO business_form_fields (business_id, attribute_key, label, input_type, options, sort_order)
SELECT business_id, attribute_key, label, input_type, options, sort_order
FROM product_variant_attributes;