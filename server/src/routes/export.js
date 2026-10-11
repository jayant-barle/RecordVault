import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { query } from '../db/index.js';
import { getRecordsForExport, generateExcelExport, generatePdfExport } from '../services/exportService.js';

const router = express.Router();
router.use(requireAuth);

// POST /api/export/excel
router.post('/excel', async (req, res) => {
  try {
    const { selectedIds, datasetId, queryText, searchField, selectedColumns, title } = req.body;

    const records = await getRecordsForExport({ selectedIds, datasetId, queryText, searchField });

    if (records.length === 0) {
      return res.status(400).json({ success: false, error: 'No matching records found to export.' });
    }

    const excelBuffer = generateExcelExport(records, {
      selectedColumns,
      title: title || 'Business_Records_Export',
    });

    // Audit log
    await query(`
      INSERT INTO audit_logs (user_id, username, action, target_type, target_id, details, ip_address, created_at)
      VALUES ($1, $2, 'EXPORT_EXCEL', 'export', $3, $4, $5, CURRENT_TIMESTAMP)
    `, [
      req.user.id,
      req.user.username,
      'excel',
      JSON.stringify({ exportedCount: records.length, selectedColumnsCount: selectedColumns?.length || 0 }),
      req.ip || '127.0.0.1',
    ]);

    const filename = `records_export_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(excelBuffer);
  } catch (err) {
    console.error('Excel export error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/export/pdf
router.post('/pdf', async (req, res) => {
  try {
    const { selectedIds, datasetId, queryText, searchField, selectedColumns, title } = req.body;

    const records = await getRecordsForExport({ selectedIds, datasetId, queryText, searchField });

    if (records.length === 0) {
      return res.status(400).json({ success: false, error: 'No matching records found to export.' });
    }

    const pdfBuffer = await generatePdfExport(records, {
      selectedColumns,
      title: title || 'Business Records Report',
    });

    // Audit log
    await query(`
      INSERT INTO audit_logs (user_id, username, action, target_type, target_id, details, ip_address, created_at)
      VALUES ($1, $2, 'EXPORT_PDF', 'export', $3, $4, $5, CURRENT_TIMESTAMP)
    `, [
      req.user.id,
      req.user.username,
      'pdf',
      JSON.stringify({ exportedCount: records.length, selectedColumnsCount: selectedColumns?.length || 0 }),
      req.ip || '127.0.0.1',
    ]);

    const filename = `records_report_${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF export error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
