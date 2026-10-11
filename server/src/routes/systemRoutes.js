import express from 'express';
import { getLocalIpAddress } from '../utils/networkIp.js';
import { getDbMode, query } from '../db/index.js';
import { config } from '../config/index.js';

const router = express.Router();

// GET /api/system/health - Comprehensive safe health check
router.get('/health', async (req, res) => {
  const startTime = Date.now();
  let dbStatus = 'healthy';
  let dbLatencyMs = null;

  try {
    const t0 = Date.now();
    await query('SELECT 1 as alive');
    dbLatencyMs = Date.now() - t0;
  } catch (err) {
    dbStatus = 'unhealthy';
    console.error('Database health check failed:', err.message);
  }

  const lanIp = getLocalIpAddress();
  const port = process.env.PORT || 5000;

  const isHealthy = dbStatus === 'healthy';
  const responseData = {
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    service: 'RecordVault Backend API',
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      status: dbStatus,
      mode: getDbMode(),
      latencyMs: dbLatencyMs,
    },
    lan: {
      hostIp: lanIp,
      apiPort: port,
      clientPort: 5173,
      apiUrl: `http://${lanIp}:${port}/api`,
      clientUrl: config.clientUrl || `http://${lanIp}:5173`,
    },
    checkDurationMs: Date.now() - startTime,
  };

  res.status(isHealthy ? 200 : 503).json(responseData);
});

// GET /api/system/info - System network & connection metadata
router.get('/info', (req, res) => {
  const lanIp = getLocalIpAddress();
  const port = process.env.PORT || 5000;
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    lanIp,
    apiPort: port,
    apiUrl: `http://${lanIp}:${port}/api`,
    webUrl: config.clientUrl || `http://${lanIp}:5173`,
    dbMode: getDbMode(),
    troubleshooting: {
      windows11IpCheck: 'Open PowerShell or Command Prompt and run: ipconfig',
      windowsFirewallTip: 'Ensure Windows Defender Firewall allows incoming TCP on ports 5000 and 5173 for Private Networks.',
      firewallCommand: 'netsh advfirewall firewall add rule name="RecordVault" dir=in action=allow protocol=TCP localport=5000,5173',
      sameWifiCheck: 'All devices (phones, tablets, laptops) must be connected to the exact same Wi-Fi router / SSID.',
    }
  });
});

export default router;
