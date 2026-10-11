import express from 'express';
import { getLocalIpAddress } from '../utils/networkIp.js';
import { getDbMode } from '../db/index.js';

const router = express.Router();

router.get('/info', (req, res) => {
  const lanIp = getLocalIpAddress();
  const port = process.env.PORT || 5000;
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    lanIp,
    apiPort: port,
    apiUrl: `http://${lanIp}:${port}/api`,
    webUrl: `http://${lanIp}:5173`,
    dbMode: getDbMode()
  });
});

export default router;
