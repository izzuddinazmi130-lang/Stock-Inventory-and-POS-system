ALTER TABLE product_variants
    ADD COLUMN warehouse_id INT NULL AFTER master_product_id,
    ADD INDEX idx_product_variants_warehouse_id (warehouse_id);

UPDATE product_variants pv
LEFT JOIN inventory i ON i.product_variant_id = pv.id
SET pv.warehouse_id = i.warehouse_id
WHERE pv.warehouse_id IS NULL;

ALTER TABLE product_variants
    ADD CONSTRAINT fk_product_variants_warehouse
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
