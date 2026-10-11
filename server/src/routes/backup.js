import express from 'express';
import path from 'path';
import fs from 'fs';
import { requireAuth } from '../middleware/auth.js';
import { listBackups, createBackup, restoreBackup, updateBackupSettings, initScheduledBackups, getBackupSettings } from '../services/backupService.js';
import { query } from '../db/index.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/backup or /api/backup/list - List backups and settings
const handleList = async (req, res) => {
  try {
    const data = await listBackups();
    res.json({ success: true, data: data.jobs || [], backups: data.jobs || [], ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
router.get('/', handleList);
router.get('/list', handleList);

// POST /api/backup/create or /api/backup/manual - Trigger manual backup
const handleCreate = async (req, res) => {
  try {
    const result = await createBackup({
      backupType: 'manual',
      userId: req.user?.id,
      username: req.user?.username || 'admin',
    });
    res.json({ success: true, message: 'Manual backup completed successfully.', backup: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
router.post('/create', handleCreate);
router.post('/manual', handleCreate);

// GET /api/backup/schedule or /api/backup/settings - Get settings
const handleGetSchedule = async (req, res) => {
  try {
    const settings = await getBackupSettings();
    res.json({ success: true, data: settings, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
router.get('/schedule', handleGetSchedule);
router.get('/settings', handleGetSchedule);

// PUT /api/backup/schedule or /api/backup/settings - Update schedule configuration
const handleUpdateSchedule = async (req, res) => {
  try {
    const { enabled, frequencyHours, retentionDays, backupDir } = req.body;
    const updated = await updateBackupSettings({
      enabled: enabled !== undefined ? Boolean(enabled) : undefined,
      frequencyHours: frequencyHours ? parseInt(frequencyHours, 10) : undefined,
      retentionDays: retentionDays ? parseInt(retentionDays, 10) : undefined,
      backupDir: backupDir ? String(backupDir).trim() : undefined,
    });

    await initScheduledBackups();
    res.json({ success: true, message: 'Backup settings updated.', settings: updated, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
router.put('/schedule', handleUpdateSchedule);
router.put('/settings', handleUpdateSchedule);

// POST /api/backup/restore - Restore selected backup
router.post('/restore', async (req, res) => {
  try {
    const { backupId, filename } = req.body;
    const result = await restoreBackup({
      backupId,
      filename,
      userId: req.user?.id,
      username: req.user?.username || 'admin',
    });

    res.json({ success: true, message: 'Database successfully restored.', ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/backup/:id/download or /api/backup/download/:filename
router.get('/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    const settings = await getBackupSettings();
    let targetPath = null;

    // Check by ID
    const jobRes = await query('SELECT * FROM backup_jobs WHERE id = $1', [id]);
    if (jobRes.rows.length > 0 && fs.existsSync(jobRes.rows[0].filepath)) {
      targetPath = jobRes.rows[0].filepath;
    } else {
      // Check by filename
      const candidate = path.join(path.resolve(settings.backupDir), path.basename(id));
      if (fs.existsSync(candidate)) {
        targetPath = candidate;
      }
    }

    if (!targetPath) {
      return res.status(404).json({ success: false, error: 'Backup file not found.' });
    }

    res.download(targetPath);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/download/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const settings = await getBackupSettings();
    const cleanFilename = path.basename(filename);
    const fullPath = path.join(path.resolve(settings.backupDir), cleanFilename);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, error: 'Backup file not found on disk.' });
    }

    res.download(fullPath, cleanFilename);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
