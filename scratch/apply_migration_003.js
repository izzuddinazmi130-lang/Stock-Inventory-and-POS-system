const pool = require('../backend/src/config/db');

async function run() {
  try {
    console.log('Running migration 003...');
    
    // Add businesses columns
    const busCols = [
      "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS legal_name VARCHAR(255) NULL",
      "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100) NULL",
      "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS industry VARCHAR(100) NULL",
      "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS contact_person VARCHAR(150) NULL",
      "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS contact_email VARCHAR(150) NULL",
      "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50) NULL",
      "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS address TEXT NULL",
      "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS notes TEXT NULL"
    ];

    for (const q of busCols) {
      await pool.query(q).catch(e => console.log('Notice:', e.message));
    }

    // Add branches columns
    const brCols = [
      "ALTER TABLE branches ADD COLUMN IF NOT EXISTS branch_code VARCHAR(50) NULL",
      "ALTER TABLE branches ADD COLUMN IF NOT EXISTS state VARCHAR(100) NULL",
      "ALTER TABLE branches ADD COLUMN IF NOT EXISTS postcode VARCHAR(20) NULL",
      "ALTER TABLE branches ADD COLUMN IF NOT EXISTS contact_person VARCHAR(150) NULL",
      "ALTER TABLE branches ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50) NULL",
      "ALTER TABLE branches ADD COLUMN IF NOT EXISTS contact_email VARCHAR(150) NULL",
      "ALTER TABLE branches ADD COLUMN IF NOT EXISTS operating_hours VARCHAR(150) NULL",
      "ALTER TABLE branches ADD COLUMN IF NOT EXISTS opening_date DATE NULL",
      "ALTER TABLE branches ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1"
    ];

    for (const q of brCols) {
      await pool.query(q).catch(e => console.log('Notice:', e.message));
    }

    // Add stores columns
    const stCols = [
      "ALTER TABLE stores ADD COLUMN IF NOT EXISTS venue VARCHAR(255) NULL",
      "ALTER TABLE stores ADD COLUMN IF NOT EXISTS person_in_charge VARCHAR(150) NULL",
      "ALTER TABLE stores ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50) NULL",
      "ALTER TABLE stores ADD COLUMN IF NOT EXISTS notes TEXT NULL"
    ];

    for (const q of stCols) {
      await pool.query(q).catch(e => console.log('Notice:', e.message));
    }

    console.log('Migration 003 completed successfully!');
    process.exit(0);
  } catch (e) {
    console.error('Migration error:', e);
    process.exit(1);
  }
}

run();
