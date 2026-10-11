import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { query } from '../db/index.js';

const router = express.Router();

router.use(requireAuth);

// GET /api/audit/logs - Paginated audit trail
router.get('/logs', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const offset = (page - 1) * limit;

    const countRes = await query('SELECT COUNT(*) as total FROM audit_logs');
    const total = parseInt(countRes.rows[0]?.total || 0, 10);

    const logsRes = await query(`
      SELECT id, user_id, username, action, target_type, target_id, details, ip_address, created_at
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.json({
      success: true,
      data: logsRes.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/audit/search-history - Recent searches
router.get('/search-history', async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const result = await query(`
      SELECT id, user_id, username, search_field, criteria_summary, result_count, created_at
      FROM search_history
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/audit/stats - Overview metrics
router.get('/stats', async (req, res) => {
  try {
    const recordCountRes = await query('SELECT COUNT(*) as count FROM records');
    const datasetCountRes = await query('SELECT COUNT(*) as count FROM datasets');
    const importCountRes = await query('SELECT COUNT(*) as count FROM import_jobs');
    const searchCountRes = await query('SELECT COUNT(*) as count FROM search_history');

    res.json({
      success: true,
      data: {
        totalRecords: parseInt(recordCountRes.rows[0]?.count || 0, 10),
        totalDatasets: parseInt(datasetCountRes.rows[0]?.count || 0, 10),
        totalImports: parseInt(importCountRes.rows[0]?.count || 0, 10),
        totalSearches: parseInt(searchCountRes.rows[0]?.count || 0, 10),
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
