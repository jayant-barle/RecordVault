import bcrypt from 'bcryptjs';
import { query } from './index.js';

export async function runMigrations() {
  console.log('🔄 Running database migrations...');

  // 1. Users Table
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'admin',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Datasets Table
  await query(`
    CREATE TABLE IF NOT EXISTS datasets (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      source_filename VARCHAR(255),
      worksheet_name VARCHAR(255),
      record_count INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 3. Records Table
  await query(`
    CREATE TABLE IF NOT EXISTS records (
      id VARCHAR(64) PRIMARY KEY,
      dataset_id VARCHAR(64) REFERENCES datasets(id) ON DELETE CASCADE,
      excel_id VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      mobile VARCHAR(100),
      email VARCHAR(255),
      company VARCHAR(255),
      custom_fields JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_dataset_excel_id UNIQUE(dataset_id, excel_id)
    );
  `);

  // 4. Import Jobs Table
  await query(`
    CREATE TABLE IF NOT EXISTS import_jobs (
      id VARCHAR(64) PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      filename VARCHAR(255) NOT NULL,
      worksheet VARCHAR(255),
      dataset_id VARCHAR(64),
      mode VARCHAR(50) NOT NULL,
      total_processed INTEGER DEFAULT 0,
      inserted INTEGER DEFAULT 0,
      updated INTEGER DEFAULT 0,
      skipped INTEGER DEFAULT 0,
      failed INTEGER DEFAULT 0,
      errors JSONB DEFAULT '[]'::jsonb,
      status VARCHAR(50) DEFAULT 'completed',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 5. Search History Table
  await query(`
    CREATE TABLE IF NOT EXISTS search_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      username VARCHAR(100),
      search_field VARCHAR(100),
      criteria_summary VARCHAR(255),
      result_count INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 6. Audit Logs Table
  await query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      username VARCHAR(100),
      action VARCHAR(100) NOT NULL,
      target_type VARCHAR(100),
      target_id VARCHAR(255),
      details JSONB DEFAULT '{}'::jsonb,
      ip_address VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 7. Indexes for High-Speed Exact-Match & Filtering
  await query(`CREATE INDEX IF NOT EXISTS idx_records_excel_id ON records (excel_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_records_name ON records (name);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_records_mobile ON records (mobile);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_records_email ON records (email);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_records_company ON records (company);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_records_dataset_id ON records (dataset_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_records_custom_fields ON records USING gin (custom_fields);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_search_history_created_at ON search_history (created_at DESC);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);`);

  // 8. Seed Default Users if none exist
  const existingUsers = await query(`SELECT COUNT(*) as count FROM users;`);
  const count = parseInt(existingUsers.rows[0].count, 10);
  if (count === 0) {
    console.log('🌱 Seeding initial authenticated users (admin & manager)...');
    const adminHash = bcrypt.hashSync('admin123', 10);
    const managerHash = bcrypt.hashSync('manager123', 10);

    await query(`
      INSERT INTO users (username, password_hash, role)
      VALUES 
        ($1, $2, 'admin'),
        ($3, $4, 'admin');
    `, ['admin', adminHash, 'manager', managerHash]);
    console.log('✅ Seeded default users: [admin / admin123], [manager / manager123]');
  }

  console.log('✅ Database schema and migrations applied successfully.');
}
