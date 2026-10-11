import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, getDbMode } from '../server/src/db/index.js';
import { runMigrations } from '../server/src/db/migrations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backupDir = path.resolve(__dirname, '../backups');

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

async function backup() {
  await runMigrations();
  console.log(`📦 Creating full system backup (Mode: ${getDbMode()})...`);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `backup_${timestamp}.json`);

  const users = await query('SELECT id, username, password_hash, role, created_at FROM users');
  const datasets = await query('SELECT * FROM datasets');
  const records = await query('SELECT * FROM records');
  const importJobs = await query('SELECT * FROM import_jobs');
  const searchHistory = await query('SELECT * FROM search_history');
  const auditLogs = await query('SELECT * FROM audit_logs');

  const dump = {
    metadata: {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      databaseMode: getDbMode(),
    },
    tables: {
      users: users.rows,
      datasets: datasets.rows,
      records: records.rows,
      import_jobs: importJobs.rows,
      search_history: searchHistory.rows,
      audit_logs: auditLogs.rows,
    }
  };

  fs.writeFileSync(backupFile, JSON.stringify(dump, null, 2), 'utf-8');
  console.log(`✅ Backup successfully saved to: ${backupFile}`);
  console.log(`   Datasets: ${datasets.rows.length}, Records: ${records.rows.length}, Audit logs: ${auditLogs.rows.length}`);
  process.exit(0);
}

backup().catch(err => {
  console.error('❌ Backup failed:', err);
  process.exit(1);
});
