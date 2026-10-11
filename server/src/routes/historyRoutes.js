import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { getSearchHistory, getAuditLogs, clearSearchHistory } from '../services/auditService.js';

const router = express.Router();

router.get('/search', authenticate, async (req, res) => {
  try {
    const history = await getSearchHistory(50);
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch search history.' });
  }
});

router.delete('/search', authenticate, async (req, res) => {
  try {
    const result = await clearSearchHistory(req.user.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear search history.' });
  }
});

router.get('/audit', authenticate, async (req, res) => {
  try {
    const logs = await getAuditLogs(100);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
});

export default router;
