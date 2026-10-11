import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { runDataQualityAnalysis, generateDataQualityCsv } from '../services/dataQualityService.js';

const router = express.Router();

router.use(requireAuth);

// GET /api/data-quality - Run analysis
router.get('/', async (req, res) => {
  try {
    const datasetId = req.query.datasetId || null;
    const report = await runDataQualityAnalysis({ datasetId });
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/data-quality/export - Download CSV report
router.get('/export', async (req, res) => {
  try {
    const datasetId = req.query.datasetId || null;
    const csvContent = await generateDataQualityCsv({ datasetId });
    const filename = `data_quality_report_${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
