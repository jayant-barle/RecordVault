import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, withTransaction, getDbMode } from '../server/src/db/index.js';
import { runMigrations } from '../server/src/db/migrations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backupDir = path.resolve(__dirname, '../backups');

async function restore() {
  await runMigrations();

  const backupFileName = process.argv[2];
  let targetFile = null;

  if (backupFileName) {
    targetFile = path.isAbsolute(backupFileName) ? backupFileName : path.join(backupDir, backupFileName);
  } else {
    // Find latest backup in backups/
    if (!fs.existsSync(backupDir)) {
      console.error('❌ No backups directory found.');
      process.exit(1);
    }
    const files = fs.readdirSync(backupDir).filter(f => f.startsWith('backup_') && f.endsWith('.json'));
    if (files.length === 0) {
      console.error('❌ No backup files found in backups/ directory.');
      process.exit(1);
    }
    files.sort().reverse();
    targetFile = path.join(backupDir, files[0]);
  }

  console.log(`🔄 Restoring database from: ${targetFile}...`);
  const raw = fs.readFileSync(targetFile, 'utf-8');
  const dump = JSON.parse(raw);

  await withTransaction(async (client) => {
    // Clean current state
    await client.query('DELETE FROM records');
    await client.query('DELETE FROM datasets');
    await client.query('DELETE FROM import_jobs');
    await client.query('DELETE FROM search_history');
    await client.query('DELETE FROM audit_logs');

    // Restore datasets
    for (const d of dump.tables.datasets || []) {
      await client.query(`
        INSERT INTO datasets (id, name, source_filename, worksheet_name, record_count, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [d.id, d.name, d.source_filename, d.worksheet_name, d.record_count, d.created_at, d.updated_at]);
    }

    // Restore records
    for (const r of dump.tables.records || []) {
      const cf = typeof r.custom_fields === 'string' ? r.custom_fields : JSON.stringify(r.custom_fields || {});
      await client.query(`
        INSERT INTO records (id, dataset_id, excel_id, name, mobile, email, company, custom_fields, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [r.id, r.dataset_id, r.excel_id, r.name, r.mobile, r.email, r.company, cf, r.created_at, r.updated_at]);
    }

    // Restore import jobs
    for (const j of dump.tables.import_jobs || []) {
      const errs = typeof j.errors === 'string' ? j.errors : JSON.stringify(j.errors || []);
      await client.query(`
        INSERT INTO import_jobs (id, user_id, filename, worksheet, dataset_id, mode, total_processed, inserted, updated, skipped, failed, errors, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [j.id, j.user_id, j.filename, j.worksheet, j.dataset_id, j.mode, j.total_processed, j.inserted, j.updated, j.skipped, j.failed, errs, j.status, j.created_at]);
    }

    // Restore search history
    for (const s of dump.tables.search_history || []) {
      await client.query(`
        INSERT INTO search_history (user_id, username, search_field, criteria_summary, result_count, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [s.user_id, s.username, s.search_field, s.criteria_summary, s.result_count, s.created_at]);
    }

    // Restore audit logs
    for (const a of dump.tables.audit_logs || []) {
      const d = typeof a.details === 'string' ? a.details : JSON.stringify(a.details || {});
      await client.query(`
        INSERT INTO audit_logs (user_id, username, action, target_type, target_id, details, ip_address, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [a.user_id, a.username, a.action, a.target_type, a.target_id, d, a.ip_address, a.created_at]);
    }
  });

  console.log('✅ Database restoration completed successfully.');
  process.exit(0);
}

restore().catch(err => {
  console.error('❌ Restore failed:', err);
  process.exit(1);
});
