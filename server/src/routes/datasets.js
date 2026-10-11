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
