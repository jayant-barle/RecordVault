import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { query, withTransaction } from '../db/index.js';
import { searchRecords } from '../services/searchService.js';

const router = express.Router();

// Protect all record routes
router.use(requireAuth);

// GET /api/records - Search, filter, paginate, sort
router.get('/', async (req, res) => {
  try {
    const {
      q,
      field = 'all',
      datasetId,
      page = 1,
      limit = 25,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = req.query;

    const result = await searchRecords({
      queryText: q,
      searchField: field,
      datasetId,
      page,
      limit,
      sortBy,
      sortOrder,
      userId: req.user?.id,
      username: req.user?.username,
    });

    res.json({
      success: true,
      data: result.records,
      pagination: result.pagination,
      filter: result.filter,
    });
  } catch (err) {
    console.error('Record search error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/records/:id - View complete details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT 
        r.*, 
        d.name as dataset_name, 
        d.source_filename, 
        d.worksheet_name 
      FROM records r
      LEFT JOIN datasets d ON r.dataset_id = d.id
      WHERE r.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Record not found.' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/records/:id - Edit record
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, mobile, email, company, custom_fields } = req.body;

    const existingRes = await query('SELECT * FROM records WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Record not found.' });
    }

    const currentRecord = existingRes.rows[0];

    // Clean inputs while preserving leading zeros in mobile
    const updatedName = name !== undefined ? String(name).trim() : currentRecord.name;
    const updatedMobile = mobile !== undefined ? String(mobile).trim() : currentRecord.mobile;
    const updatedEmail = email !== undefined ? String(email).trim() : currentRecord.email;
    const updatedCompany = company !== undefined ? String(company).trim() : currentRecord.company;
    
    let updatedCustom = currentRecord.custom_fields || {};
    if (custom_fields && typeof custom_fields === 'object') {
      updatedCustom = custom_fields;
    }

    await query(`
      UPDATE records 
      SET 
        name = $1, 
        mobile = $2, 
        email = $3, 
        company = $4, 
        custom_fields = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
    `, [
      updatedName,
      updatedMobile,
      updatedEmail,
      updatedCompany,
      JSON.stringify(updatedCustom),
      id,
    ]);

    // Audit log
    await query(`
      INSERT INTO audit_logs (user_id, username, action, target_type, target_id, details, ip_address, created_at)
      VALUES ($1, $2, 'UPDATE_RECORD', 'record', $3, $4, $5, CURRENT_TIMESTAMP)
    `, [
      req.user.id,
      req.user.username,
      id,
      JSON.stringify({
        excel_id: currentRecord.excel_id,
        changes: {
          name: updatedName !== currentRecord.name ? { from: currentRecord.name, to: updatedName } : undefined,
          mobile: updatedMobile !== currentRecord.mobile ? { from: currentRecord.mobile, to: updatedMobile } : undefined,
          email: updatedEmail !== currentRecord.email ? { from: currentRecord.email, to: updatedEmail } : undefined,
          company: updatedCompany !== currentRecord.company ? { from: currentRecord.company, to: updatedCompany } : undefined,
        }
      }),
      req.ip || '127.0.0.1',
    ]);

    const updatedRes = await query(`
      SELECT r.*, d.name as dataset_name 
      FROM records r 
      LEFT JOIN datasets d ON r.dataset_id = d.id 
      WHERE r.id = $1
    `, [id]);

    res.json({
      success: true,
      message: 'Record updated successfully.',
      data: updatedRes.rows[0],
    });
  } catch (err) {
    console.error('Update record error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/records/:id - Delete single record
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existingRes = await query('SELECT * FROM records WHERE id = $1', [id]);

    if (existingRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Record not found.' });
    }

    const currentRecord = existingRes.rows[0];

    await withTransaction(async (client) => {
      await client.query('DELETE FROM records WHERE id = $1', [id]);
      // Update dataset count
      await client.query(`
        UPDATE datasets 
        SET record_count = (SELECT COUNT(*) FROM records WHERE dataset_id = $1),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [currentRecord.dataset_id]);
    });

    // Audit log
    await query(`
      INSERT INTO audit_logs (user_id, username, action, target_type, target_id, details, ip_address, created_at)
      VALUES ($1, $2, 'DELETE_RECORD', 'record', $3, $4, $5, CURRENT_TIMESTAMP)
    `, [
      req.user.id,
      req.user.username,
      id,
      JSON.stringify({ excel_id: currentRecord.excel_id, name: currentRecord.name, dataset_id: currentRecord.dataset_id }),
      req.ip || '127.0.0.1',
    ]);

    res.json({ success: true, message: 'Record deleted successfully.' });
  } catch (err) {
    console.error('Delete record error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/records/batch-delete - Delete multiple records
router.post('/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'No record IDs provided for deletion.' });
    }

    await withTransaction(async (client) => {
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
      await client.query(`DELETE FROM records WHERE id IN (${placeholders})`, ids);
      // Recalculate dataset counts
      await client.query(`
        UPDATE datasets d
        SET record_count = (SELECT COUNT(*) FROM records r WHERE r.dataset_id = d.id),
            updated_at = CURRENT_TIMESTAMP
      `);
    });

    // Audit log
    await query(`
      INSERT INTO audit_logs (user_id, username, action, target_type, target_id, details, ip_address, created_at)
      VALUES ($1, $2, 'BATCH_DELETE_RECORDS', 'record', $3, $4, $5, CURRENT_TIMESTAMP)
    `, [
      req.user.id,
      req.user.username,
      'batch',
      JSON.stringify({ deletedCount: ids.length, ids }),
      req.ip || '127.0.0.1',
    ]);

    res.json({ success: true, message: `Successfully deleted ${ids.length} records.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
