import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { searchRecords } from '../services/searchService.js';
import { getRecordById, updateRecord, deleteRecord, deleteBulkRecords } from '../services/recordService.js';

const router = express.Router();

// Exact-match search across records
router.get('/search', authenticate, async (req, res) => {
  try {
    const {
      term = '',
      field = 'all',
      customField = '',
      datasetId,
      page = 1,
      limit = 20,
      sortBy = 'id',
      sortOrder = 'DESC'
    } = req.query;

    const result = await searchRecords({
      searchTerm: term,
      searchField: field,
      customFieldName: customField,
      datasetId,
      page,
      limit,
      sortBy,
      sortOrder,
      userId: req.user.id
    });

    res.json(result);
  } catch (err) {
    console.error('[Records] Search error:', err);
    res.status(500).json({ error: err.message || 'An error occurred during search.' });
  }
});

// Get record details by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const record = await getRecordById(req.params.id);
    if (!record) {
      return res.status(404).json({ error: 'Record not found.' });
    }
    res.json({ record });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to retrieve record.' });
  }
});

// Update record
router.put('/:id', authenticate, async (req, res) => {
  try {
    const updated = await updateRecord(req.params.id, req.body, req.user.id);
    res.json({ success: true, record: updated });
  } catch (err) {
    console.error('[Records] Update error:', err);
    res.status(400).json({ error: err.message || 'Failed to update record.' });
  }
});

// Delete record
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const result = await deleteRecord(req.params.id, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('[Records] Delete error:', err);
    res.status(400).json({ error: err.message || 'Failed to delete record.' });
  }
});

// Bulk delete records
router.post('/bulk-delete', authenticate, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Array of record IDs required for bulk deletion.' });
    }
    const result = await deleteBulkRecords(ids, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('[Records] Bulk delete error:', err);
    res.status(400).json({ error: err.message || 'Failed to bulk delete records.' });
  }
});

export default router;
