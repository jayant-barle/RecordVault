import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { query, withTransaction, getDbMode } from '../db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_BACKUP_DIR = process.env.BACKUP_DIR || path.resolve(__dirname, '../../../backups');

/**
 * Returns active backup settings from system_settings
 */
export async function getBackupSettings() {
  try {
    const res = await query(`SELECT value FROM system_settings WHERE key = 'backup_schedule'`);
    if (res.rows.length > 0) {
      const val = typeof res.rows[0].value === 'string' ? JSON.parse(res.rows[0].value) : res.rows[0].value;
      return {
        enabled: val.enabled ?? true,
        frequencyHours: val.frequencyHours || 24,
        retentionDays: val.retentionDays || 7,
        backupDir: val.backupDir || DEFAULT_BACKUP_DIR
      };
    }
  } catch (err) {
    console.warn('⚠️ Could not load backup settings:', err.message);
  }
  return {
    enabled: true,
    frequencyHours: 24,
    retentionDays: 7,
    backupDir: DEFAULT_BACKUP_DIR
  };
}

/**
 * Updates backup settings
 */
export async function updateBackupSettings(newSettings) {
  const current = await getBackupSettings();
  const merged = { ...current, ...newSettings };
  await query(`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES ('backup_schedule', $1, CURRENT_TIMESTAMP)
    ON CONFLICT (key) DO UPDATE
    SET value = $1, updated_at = CURRENT_TIMESTAMP
  `, [JSON.stringify(merged)]);
  return merged;
}

/**
 * Resolves and validates local backup directory
 */
function resolveBackupDir(customDir) {
  const dir = customDir ? path.resolve(customDir) : DEFAULT_BACKUP_DIR;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Creates a database backup dump
 */
export async function createBackup({ backupType = 'manual', userId = null, username = 'system' } = {}) {
  const jobId = crypto.randomUUID();
  const settings = await getBackupSettings();
  const targetDir = resolveBackupDir(settings.backupDir);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `recordvault_${backupType}_${timestamp}.json`;
  const filepath = path.join(targetDir, filename);

  try {
    // Collect all table data
    const users = await query('SELECT id, username, password_hash, role, created_at FROM users');
    const datasets = await query('SELECT * FROM datasets');
    const records = await query('SELECT * FROM records');
    const recordVersions = await query('SELECT * FROM record_versions');
    const importJobs = await query('SELECT * FROM import_jobs');
    const importJournal = await query('SELECT * FROM import_journal');
    const searchHistory = await query('SELECT * FROM search_history');
    const auditLogs = await query('SELECT * FROM audit_logs');
    const systemSettings = await query('SELECT * FROM system_settings');

    const payload = {
      metadata: {
        jobId,
        backupType,
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        dbMode: getDbMode(),
        counts: {
          users: users.rows.length,
          datasets: datasets.rows.length,
          records: records.rows.length,
          recordVersions: recordVersions.rows.length,
          importJobs: importJobs.rows.length,
        }
      },
      tables: {
        users: users.rows,
        datasets: datasets.rows,
        records: records.rows,
        record_versions: recordVersions.rows,
        import_jobs: importJobs.rows,
        import_journal: importJournal.rows,
        search_history: searchHistory.rows,
        audit_logs: auditLogs.rows,
        system_settings: systemSettings.rows,
      }
    };

    fs.writeFileSync(filepath, JSON.stringify(payload, null, 2), 'utf-8');
    const stats = fs.statSync(filepath);

    // Record completed backup job
    await query(`
      INSERT INTO backup_jobs (id, filename, filepath, size_bytes, backup_type, status, details, created_by, created_at)
      VALUES ($1, $2, $3, $4, $5, 'completed', $6, $7, CURRENT_TIMESTAMP)
    `, [
      jobId,
      filename,
      filepath,
      stats.size,
      backupType,
      JSON.stringify(payload.metadata),
      userId
    ]);

    // Audit log
    await query(`
      INSERT INTO audit_logs (user_id, username, action, target_type, target_id, details, ip_address, created_at)
      VALUES ($1, $2, 'CREATE_BACKUP', 'backup', $3, $4, '127.0.0.1', CURRENT_TIMESTAMP)
    `, [userId, username, jobId, JSON.stringify({ filename, sizeBytes: stats.size, backupType })]);

    // Prune old backups per retention policy
    await pruneOldBackups(settings.retentionDays, targetDir);

    return {
      success: true,
      jobId,
      filename,
      filepath,
      sizeBytes: stats.size,
      backupType,
      recordCount: records.rows.length,
      createdAt: payload.metadata.timestamp
    };
  } catch (err) {
    console.error('❌ Backup failure:', err);
    // Record failed backup job
    try {
      await query(`
        INSERT INTO backup_jobs (id, filename, filepath, size_bytes, backup_type, status, details, created_by, created_at)
        VALUES ($1, $2, $3, 0, $4, 'failed', $5, $6, CURRENT_TIMESTAMP)
      `, [
        jobId,
        filename,
        filepath,
        backupType,
        JSON.stringify({ error: err.message }),
        userId
      ]);
    } catch {}
    throw new Error(`Failed to create backup: ${err.message}`);
  }
}

/**
 * Restores database from a verified backup file with safety pre-restore backup
 */
export async function restoreBackup({ backupId = null, filename = null, userId = null, username = 'system' }) {
  let targetFile = null;
  const settings = await getBackupSettings();
  const targetDir = resolveBackupDir(settings.backupDir);

  if (backupId) {
    const jobRes = await query('SELECT * FROM backup_jobs WHERE id = $1', [backupId]);
    if (jobRes.rows.length > 0 && fs.existsSync(jobRes.rows[0].filepath)) {
      targetFile = jobRes.rows[0].filepath;
    }
  }

  if (!targetFile && filename) {
    const candidate = path.join(targetDir, path.basename(filename));
    if (fs.existsSync(candidate)) {
      targetFile = candidate;
    }
  }

  if (!targetFile) {
    throw new Error('Specified backup file could not be located on disk.');
  }

  // 1. Mandatory Safety Pre-Restore Backup
  console.log('🛡️ Creating pre-restore safety backup...');
  const safetyBackup = await createBackup({
    backupType: 'pre_restore_safety',
    userId,
    username: `${username} (Safety Pre-Restore)`
  });
  console.log(`✅ Safety backup created: ${safetyBackup.filename}`);

  // 2. Validate backup contents
  const rawContent = fs.readFileSync(targetFile, 'utf-8');
  let dumpData;
  try {
    dumpData = JSON.parse(rawContent);
  } catch (err) {
    throw new Error(`Corrupted backup file: ${err.message}`);
  }

  if (!dumpData.tables || !dumpData.tables.records) {
    throw new Error('Invalid backup archive structure: missing essential database tables.');
  }

  // 3. Transactional restoration
  return await withTransaction(async (client) => {
    // Clear dependent tables
    await client.query('DELETE FROM import_journal');
    await client.query('DELETE FROM record_versions');
    await client.query('DELETE FROM records');
    await client.query('DELETE FROM datasets');
    await client.query('DELETE FROM import_jobs');
    await client.query('DELETE FROM search_history');

    // Restore Datasets
    for (const d of dumpData.tables.datasets || []) {
      await client.query(`
        INSERT INTO datasets (id, name, source_filename, worksheet_name, record_count, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [d.id, d.name, d.source_filename, d.worksheet_name, d.record_count, d.created_at, d.updated_at]);
    }

    // Restore Records
    for (const r of dumpData.tables.records || []) {
      const cf = typeof r.custom_fields === 'string' ? r.custom_fields : JSON.stringify(r.custom_fields || {});
      await client.query(`
        INSERT INTO records (id, dataset_id, excel_id, name, mobile, email, company, custom_fields, is_deleted, deleted_at, deleted_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [r.id, r.dataset_id, r.excel_id, r.name, r.mobile, r.email, r.company, cf, r.is_deleted || false, r.deleted_at || null, r.deleted_by || null, r.created_at, r.updated_at]);
    }

    // Restore Record Versions
    for (const v of dumpData.tables.record_versions || []) {
      const snap = typeof v.snapshot === 'string' ? v.snapshot : JSON.stringify(v.snapshot || {});
      const diff = typeof v.diff === 'string' ? v.diff : JSON.stringify(v.diff || {});
      await client.query(`
        INSERT INTO record_versions (record_id, version_num, operation, snapshot, diff, user_id, username, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [v.record_id, v.version_num, v.operation, snap, diff, v.user_id, v.username, v.created_at]);
    }

    // Restore Import Jobs
    for (const j of dumpData.tables.import_jobs || []) {
      const errs = typeof j.errors === 'string' ? j.errors : JSON.stringify(j.errors || []);
      await client.query(`
        INSERT INTO import_jobs (id, user_id, filename, worksheet, dataset_id, mode, total_processed, inserted, updated, skipped, failed, errors, status, stage, can_rollback, rolled_back_at, rolled_back_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      `, [j.id, j.user_id, j.filename, j.worksheet, j.dataset_id, j.mode, j.total_processed, j.inserted, j.updated, j.skipped, j.failed, errs, j.status || 'completed', j.stage || 'completed', j.can_rollback ?? true, j.rolled_back_at || null, j.rolled_back_by || null, j.created_at]);
    }

    // Restore Import Journal
    for (const ij of dumpData.tables.import_journal || []) {
      const prev = typeof ij.previous_data === 'string' ? ij.previous_data : (ij.previous_data ? JSON.stringify(ij.previous_data) : null);
      await client.query(`
        INSERT INTO import_journal (import_job_id, action_type, record_id, dataset_id, previous_data, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [ij.import_job_id, ij.action_type, ij.record_id, ij.dataset_id, prev, ij.created_at]);
    }

    // Audit log restoration
    await client.query(`
      INSERT INTO audit_logs (user_id, username, action, target_type, target_id, details, ip_address, created_at)
      VALUES ($1, $2, 'RESTORE_BACKUP', 'backup', $3, $4, '127.0.0.1', CURRENT_TIMESTAMP)
    `, [userId, username, path.basename(targetFile), JSON.stringify({ safetyBackup: safetyBackup.filename, restoredRecords: (dumpData.tables.records || []).length })]);

    return {
      success: true,
      message: `Database restored from ${path.basename(targetFile)}`,
      restoredRecords: (dumpData.tables.records || []).length,
      safetyBackup: safetyBackup.filename
    };
  });
}

/**
 * Prunes backups older than retentionDays
 */
async function pruneOldBackups(retentionDays, targetDir) {
  if (!retentionDays || retentionDays <= 0) return;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  try {
    const files = fs.readdirSync(targetDir);
    for (const f of files) {
      if (f.startsWith('recordvault_') && f.endsWith('.json')) {
        const fullPath = path.join(targetDir, f);
        const stat = fs.statSync(fullPath);
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(fullPath);
          console.log(`🧹 Pruned expired backup: ${f}`);
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ Backup pruning error:', err.message);
  }
}

/**
 * Lists available backup records and disk files
 */
export async function listBackups() {
  const settings = await getBackupSettings();
  const targetDir = resolveBackupDir(settings.backupDir);

  const jobsRes = await query(`
    SELECT b.*, u.username
    FROM backup_jobs b
    LEFT JOIN users u ON b.created_by = u.id
    ORDER BY b.created_at DESC
    LIMIT 50
  `);

  // Check physical disk files
  const diskFiles = [];
  try {
    const files = fs.readdirSync(targetDir);
    for (const f of files) {
      if (f.startsWith('recordvault_') && f.endsWith('.json')) {
        const full = path.join(targetDir, f);
        const stat = fs.statSync(full);
        diskFiles.push({
          filename: f,
          filepath: full,
          sizeBytes: stat.size,
          mtime: stat.mtime
        });
      }
    }
  } catch {}

  return {
    settings,
    jobs: jobsRes.rows,
    diskFiles
  };
}

// Global scheduled backup timer handle
let scheduledTimer = null;

export async function initScheduledBackups() {
  if (scheduledTimer) clearInterval(scheduledTimer);

  const settings = await getBackupSettings();
  if (!settings.enabled) {
    console.log('⏰ Scheduled automatic backups are currently disabled in settings.');
    return;
  }

  const intervalMs = Math.max(1, settings.frequencyHours) * 60 * 60 * 1000;
  console.log(`⏰ Scheduled automatic backups initialized (Every ${settings.frequencyHours}h, Retention: ${settings.retentionDays}d).`);

  scheduledTimer = setInterval(async () => {
    console.log('⏰ Running scheduled automatic database backup...');
    try {
      await createBackup({ backupType: 'scheduled', username: 'system-scheduler' });
    } catch (err) {
      console.error('❌ Scheduled backup failure:', err);
    }
  }, intervalMs);
}
