-- ============================================================
-- Migration 003: Corporate Hierarchy Extensions & FK Restrictions
-- Structure Only - No Demo / Seed Data
-- ============================================================

-- 1. Extend businesses table with corporate fields
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS legal_name VARCHAR(255) NULL AFTER name,
  ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100) NULL AFTER legal_name,
  ADD COLUMN IF NOT EXISTS industry VARCHAR(100) NULL AFTER registration_number,
  ADD COLUMN IF NOT EXISTS contact_person VARCHAR(150) NULL AFTER industry,
  ADD COLUMN IF NOT EXISTS contact_email VARCHAR(150) NULL AFTER contact_person,
  ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50) NULL AFTER contact_email,
  ADD COLUMN IF NOT EXISTS address TEXT NULL AFTER contact_phone,
  ADD COLUMN IF NOT EXISTS notes TEXT NULL AFTER address;

-- 2. Extend branches table with corporate fields
ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS branch_code VARCHAR(50) NULL AFTER name,
  ADD COLUMN IF NOT EXISTS state VARCHAR(100) NULL AFTER city,
  ADD COLUMN IF NOT EXISTS postcode VARCHAR(20) NULL AFTER state,
  ADD COLUMN IF NOT EXISTS contact_person VARCHAR(150) NULL AFTER postcode,
  ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50) NULL AFTER contact_person,
  ADD COLUMN IF NOT EXISTS contact_email VARCHAR(150) NULL AFTER contact_phone,
  ADD COLUMN IF NOT EXISTS operating_hours VARCHAR(150) NULL AFTER contact_email,
  ADD COLUMN IF NOT EXISTS opening_date DATE NULL AFTER operating_hours,
  ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER opening_date;

-- 3. Extend stores table with event fields
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS venue VARCHAR(255) NULL AFTER name,
  ADD COLUMN IF NOT EXISTS person_in_charge VARCHAR(150) NULL AFTER end_date,
  ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50) NULL AFTER person_in_charge,
  ADD COLUMN IF NOT EXISTS notes TEXT NULL AFTER contact_phone;

-- 4. Update foreign key constraints to ON DELETE RESTRICT where applicable
-- (Note: MySQL doesn't directly alter FK rules without drop/add, application layer also enforces restrict)
