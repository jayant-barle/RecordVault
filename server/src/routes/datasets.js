import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { query, withTransaction } from '../db/index.js';

const router = express.Router();

router.use(requireAuth);

// GET /api/datasets
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        d.id,
        d.name,
        d.source_filename,
        d.worksheet_name,
        d.record_count,
        d.created_at,
        d.updated_at
      FROM datasets d
      ORDER BY d.created_at DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/datasets/conflicts - Detect cross-dataset ID collisions
router.get('/conflicts', async (req, res) => {
  try {
    const recordsRes = await query(`
      SELECT 
        r.id as record_id,
        r.excel_id,
        r.name,
        r.mobile,
        r.email,
        r.dataset_id,
        d.name as dataset_name,
        r.updated_at
      FROM records r
      JOIN datasets d ON r.dataset_id = d.id
      WHERE r.is_deleted = FALSE AND r.excel_id IS NOT NULL AND TRIM(r.excel_id) != ''
      ORDER BY r.excel_id ASC
    `);

    // Group in JS for maximal portability
    const idMap = new Map();
    for (const row of recordsRes.rows) {
      if (!idMap.has(row.excel_id)) {
        idMap.set(row.excel_id, []);
      }
      idMap.get(row.excel_id).push(row);
    }

    const conflicts = [];
    for (const [excelId, records] of idMap.entries()) {
      const distinctDatasets = new Set(records.map(r => r.dataset_id));
      if (distinctDatasets.size > 1) {
        conflicts.push({
          excelId,
          datasetCount: distinctDatasets.size,
          recordsCount: records.length,
          records,
        });
      }
    }

    res.json({ success: true, data: conflicts.slice(0, 100) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/datasets/:id - Dataset detail with recent import jobs
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const dsRes = await query('SELECT * FROM datasets WHERE id = $1', [id]);
    if (dsRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Dataset not found.' });
    }

    const dataset = dsRes.rows[0];

    // Get recent import jobs for this dataset
    const jobsRes = await query(`
      SELECT id, filename, worksheet, mode, status, total_rows, inserted_count, updated_count, skipped_count, failed_count, stage, can_rollback, created_at, completed_at
      FROM import_jobs
      WHERE dataset_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [id]);

    res.json({
      success: true,
      data: {
        ...dataset,
        recentImports: jobsRes.rows,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/datasets/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const dsRes = await query('SELECT * FROM datasets WHERE id = $1', [id]);
    if (dsRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Dataset not found.' });
    }

    const dataset = dsRes.rows[0];

    await withTransaction(async (client) => {
      // Cascade delete records and dataset
      await client.query('DELETE FROM records WHERE dataset_id = $1', [id]);
      await client.query('DELETE FROM datasets WHERE id = $1', [id]);
    });

    // Audit log
    await query(`
      INSERT INTO audit_logs (user_id, username, action, target_type, target_id, details, ip_address, created_at)
      VALUES ($1, $2, 'DELETE_DATASET', 'dataset', $3, $4, $5, CURRENT_TIMESTAMP)
    `, [
      req.user.id,
      req.user.username,
      id,
      JSON.stringify({ datasetName: dataset.name, recordCount: dataset.record_count }),
      req.ip || '127.0.0.1',
    ]);

    res.json({
      success: true,
      message: `Dataset "${dataset.name}" and its ${dataset.record_count} records were deleted successfully.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
