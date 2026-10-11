import express from 'express';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { inspectWorkbook, extractWorksheetRecords } from '../services/excelParser.js';
import { executeImport } from '../services/importService.js';

const router = express.Router();

router.use(requireAuth);

// In-memory buffer store for multi-step preview & confirmation workflow
// Maps sessionKey -> { originalname, buffer, expiresAt }
const uploadSessionCache = new Map();

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [key, value] of uploadSessionCache.entries()) {
    if (value.expiresAt < now) {
      uploadSessionCache.delete(key);
    }
  }
}

// POST /api/import/inspect - Upload files and receive preview metadata
router.post('/inspect', upload.array('files', 10), async (req, res) => {
  try {
    cleanExpiredSessions();

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No Excel files provided.' });
    }

    const fileResults = [];

    for (const file of req.files) {
      const fileId = crypto.randomUUID();
      const inspection = inspectWorkbook(file.buffer, file.originalname);

      // Store in session cache for 20 minutes
      uploadSessionCache.set(fileId, {
        originalname: file.originalname,
        buffer: file.buffer,
        expiresAt: Date.now() + 20 * 60 * 1000,
      });

      fileResults.push({
        fileId,
        filename: file.originalname,
        sizeBytes: file.size,
        sheets: inspection.sheets,
      });
    }

    res.json({
      success: true,
      message: `Parsed ${fileResults.length} file(s) for preview.`,
      files: fileResults,
    });
  } catch (err) {
    console.error('File inspection error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/import/commit - Confirm and execute import
router.post('/commit', async (req, res) => {
  try {
    const {
      fileId,
      sheetName,
      columnMapping = {},
      mode = 'merge', // 'replace' or 'merge'
      datasetId = null,
      datasetName = null,
    } = req.body;

    if (!fileId) {
      return res.status(400).json({ success: false, error: 'File ID is required.' });
    }

    const session = uploadSessionCache.get(fileId);
    if (!session) {
      return res.status(400).json({
        success: false,
        error: 'Upload session has expired or is invalid. Please re-upload the Excel file.',
      });
    }

    if (!sheetName) {
      return res.status(400).json({ success: false, error: 'Worksheet name is required.' });
    }

    // Extract records using user-confirmed column mapping
    const records = extractWorksheetRecords(session.buffer, sheetName, columnMapping);

    if (records.length === 0) {
      return res.status(400).json({
        success: false,
        error: `No data records found in worksheet "${sheetName}".`,
      });
    }

    // Execute transactional import
    const summary = await executeImport({
      records,
      filename: session.originalname,
      worksheet: sheetName,
      mode,
      datasetId,
      datasetName: datasetName || `${session.originalname} (${sheetName})`,
      userId: req.user?.id,
      username: req.user?.username,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({
      success: true,
      message: `Import completed (${mode.toUpperCase()} mode). Processed: ${summary.totalProcessed}, Inserted: ${summary.inserted}, Updated: ${summary.updated}, Skipped: ${summary.skipped}.`,
      summary,
    });
  } catch (err) {
    console.error('Import commit error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
