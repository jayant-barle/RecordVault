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
      is_deleted BOOLEAN DEFAULT FALSE,
      deleted_at TIMESTAMP WITH TIME ZONE NULL,
      deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_dataset_excel_id UNIQUE(dataset_id, excel_id)
    );
  `);

  // Backwards compatibility column additions if table already existed
  await query(`ALTER TABLE records ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;`);
  await query(`ALTER TABLE records ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE NULL;`);
  await query(`ALTER TABLE records ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL;`);

  // 4. Record Versions Table (Audit & Undo history)
  await query(`
    CREATE TABLE IF NOT EXISTS record_versions (
      id SERIAL PRIMARY KEY,
      record_id VARCHAR(64) NOT NULL,
      version_num INTEGER NOT NULL,
      operation VARCHAR(50) NOT NULL, -- 'CREATE', 'UPDATE', 'SOFT_DELETE', 'RESTORE', 'ROLLBACK'
      snapshot JSONB NOT NULL,
      diff JSONB DEFAULT '{}'::jsonb,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      username VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 5. Import Jobs Table
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
      stage VARCHAR(50) DEFAULT 'completed',
      can_rollback BOOLEAN DEFAULT TRUE,
      rolled_back_at TIMESTAMP WITH TIME ZONE NULL,
      rolled_back_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Backwards compatibility column additions for import_jobs
  await query(`ALTER TABLE import_jobs ADD COLUMN IF NOT EXISTS stage VARCHAR(50) DEFAULT 'completed';`);
  await query(`ALTER TABLE import_jobs ADD COLUMN IF NOT EXISTS can_rollback BOOLEAN DEFAULT TRUE;`);
  await query(`ALTER TABLE import_jobs ADD COLUMN IF NOT EXISTS rolled_back_at TIMESTAMP WITH TIME ZONE NULL;`);
  await query(`ALTER TABLE import_jobs ADD COLUMN IF NOT EXISTS rolled_back_by INTEGER REFERENCES users(id) ON DELETE SET NULL;`);

  // 6. Import Change Journal (for granular atomic rollbacks)
  await query(`
    CREATE TABLE IF NOT EXISTS import_journal (
      id SERIAL PRIMARY KEY,
      import_job_id VARCHAR(64) REFERENCES import_jobs(id) ON DELETE CASCADE,
      action_type VARCHAR(50) NOT NULL, -- 'INSERT', 'UPDATE', 'REPLACE_DELETE'
      record_id VARCHAR(64) NOT NULL,
      dataset_id VARCHAR(64) NOT NULL,
      previous_data JSONB NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 7. Search History Table
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

  // 8. Audit Logs Table
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

  // 9. Backup Jobs Table (for tracking backups & restorations)
  await query(`
    CREATE TABLE IF NOT EXISTS backup_jobs (
      id VARCHAR(64) PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      filepath VARCHAR(500) NOT NULL,
      size_bytes BIGINT DEFAULT 0,
      backup_type VARCHAR(50) NOT NULL, -- 'manual', 'scheduled', 'pre_restore_safety'
      status VARCHAR(50) NOT NULL,      -- 'completed', 'failed'
      details JSONB DEFAULT '{}'::jsonb,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 10. System Settings Table
  await query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key VARCHAR(100) PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 11. Indexes for High-Speed Exact-Match, Versions & Filtering
  await query(`CREATE INDEX IF NOT EXISTS idx_records_excel_id ON records (excel_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_records_name ON records (name);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_records_mobile ON records (mobile);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_records_email ON records (email);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_records_company ON records (company);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_records_dataset_id ON records (dataset_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_records_is_deleted ON records (is_deleted);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_records_custom_fields ON records USING gin (custom_fields);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_record_versions_record_id ON record_versions (record_id, version_num DESC);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_import_journal_job_id ON import_journal (import_job_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_search_history_created_at ON search_history (created_at DESC);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_backup_jobs_created_at ON backup_jobs (created_at DESC);`);

  // 12. Seed Default Users if none exist
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

  // 13. Initialize default backup settings if not set
  const backupSettingsRes = await query(`SELECT value FROM system_settings WHERE key = 'backup_schedule'`);
  if (backupSettingsRes.rows.length === 0) {
    const defaultSettings = {
      enabled: true,
      frequencyHours: 24,
      retentionDays: 7,
      backupDir: './backups'
    };
    await query(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ('backup_schedule', $1, CURRENT_TIMESTAMP)
    `, [JSON.stringify(defaultSettings)]);
  }

  console.log('✅ Database schema and migrations applied successfully.');
}
