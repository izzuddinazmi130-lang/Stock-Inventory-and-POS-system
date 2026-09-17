-- Migration 008: Cascade Product Deletion
ALTER TABLE damage_reports DROP FOREIGN KEY damage_reports_ibfk_1;
ALTER TABLE damage_reports ADD CONSTRAINT damage_reports_ibfk_1 FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE;
