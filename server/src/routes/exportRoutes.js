import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { getExportRecords, generateExcelExport, generatePdfExport } from '../services/exportService.js';

const router = express.Router();

// Export to Excel (.xlsx)
router.post('/excel', authenticate, async (req, res) => {
  try {
    const { ids, term, field, customField, datasetId } = req.body;

    const records = await getExportRecords({
      ids,
      searchTerm: term,
      searchField: field,
      customFieldName: customField,
      datasetId
    });

    if (!records || records.length === 0) {
      return res.status(404).json({ error: 'No matching records found to export.' });
    }

    const excelBuffer = await generateExcelExport(records, req.user.id);

    const filename = `records_export_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(excelBuffer);
  } catch (err) {
    console.error('[Export] Excel generation error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate Excel export.' });
  }
});

// Export to PDF (.pdf)
router.post('/pdf', authenticate, async (req, res) => {
  try {
    const { ids, term, field, customField, datasetId } = req.body;

    const records = await getExportRecords({
      ids,
      searchTerm: term,
      searchField: field,
      customFieldName: customField,
      datasetId
    });

    if (!records || records.length === 0) {
      return res.status(404).json({ error: 'No matching records found to export.' });
    }

    const pdfBuffer = await generatePdfExport(records, req.user.id);

    const filename = `records_report_${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[Export] PDF generation error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate PDF export.' });
  }
});

export default router;
