import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { inspectWorkbook } from '../services/excelService.js';
import { executeImport } from '../services/importService.js';
import { query } from '../db/index.js';

const router = express.Router();

// Preview uploaded files (supports single or multiple Excel workbooks)
router.post('/preview', authenticate, upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No Excel files uploaded.' });
    }

    const previewResults = [];

    for (const file of req.files) {
      try {
        const info = inspectWorkbook(file.buffer, file.originalname);
        previewResults.push(info);
      } catch (err) {
        previewResults.push({
          filename: file.originalname,
          error: `Failed to parse file: ${err.message}`
        });
      }
    }

    res.json({ files: previewResults });
  } catch (err) {
    console.error('[Import] Preview error:', err);
    res.status(500).json({ error: err.message || 'Failed to process files for preview.' });
  }
});

// Commit import transactionally
router.post('/commit', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Excel file is required to commit import.' });
    }

    const {
      sheetName,
      datasetName,
      mode = 'merge',
      columnMapping = '{}',
      skipDuplicates = 'true'
    } = req.body;

    if (!sheetName) {
      return res.status(400).json({ error: 'A valid worksheet name must be selected.' });
    }

    if (!['merge', 'replace'].includes(mode)) {
      return res.status(400).json({ error: "Import mode must be either 'merge' or 'replace'." });
    }

    let parsedMapping = {};
    try {
      parsedMapping = typeof columnMapping === 'string' ? JSON.parse(columnMapping) : columnMapping;
    } catch {
      parsedMapping = {};
    }

    const summary = await executeImport({
      fileBuffer: req.file.buffer,
      filename: req.file.originalname,
      sheetName,
      datasetName,
      mode,
      columnMapping: parsedMapping,
      skipDuplicates: skipDuplicates === 'true' || skipDuplicates === true,
      userId: req.user.id
    });

    res.json({
      success: true,
      summary
    });
  } catch (err) {
    console.error('[Import] Commit error:', err);
    res.status(500).json({ error: err.message || 'Failed to commit import. Transaction rolled back.' });
  }
});

// List datasets
router.get('/datasets', authenticate, async (req, res) => {
  try {
    const dsRes = await query('SELECT * FROM datasets ORDER BY updated_at DESC');
    res.json({ datasets: dsRes.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch datasets.' });
  }
});

// List recent import jobs
router.get('/jobs', authenticate, async (req, res) => {
  try {
    const jobsRes = await query(`
      SELECT 
        import_jobs.*,
        users.username,
        datasets.name as dataset_name
      FROM import_jobs
      LEFT JOIN users ON import_jobs.created_by = users.id
      LEFT JOIN datasets ON import_jobs.dataset_id = datasets.id
      ORDER BY import_jobs.created_at DESC
      LIMIT 50
    `);
    res.json({ jobs: jobsRes.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch import job history.' });
  }
});

export default router;
