import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { config } from './config/index.js';
import { runMigrations } from './db/migrations.js';
import { printLanAccessInfo } from './utils/networkIp.js';

// Route imports
import authRoutes from './routes/auth.js';
import recordsRoutes from './routes/records.js';
import datasetsRoutes from './routes/datasets.js';
import importRoutes from './routes/import.js';
import exportRoutes from './routes/export.js';
import auditRoutes from './routes/audit.js';
import systemRoutes from './routes/systemRoutes.js';
import backupRoutes from './routes/backup.js';
import dataQualityRoutes from './routes/dataQuality.js';
import { initScheduledBackups } from './services/backupService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Allows flexible client resource loading on LAN
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration - allow LAN clients
app.use(cors({
  origin: true, // Dynamically allow request origin
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Request logger
app.use(morgan('dev'));

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting for auth and API safety
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per 15 min window
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // 50 login attempts per 15 min
  message: { success: false, error: 'Too many login attempts. Please try again later.' },
});
app.use('/api/auth/login', authLimiter);

// API Router supporting both /api/* and root /* routing (for Vercel services)
const apiRouter = express.Router();

apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Excel Record Management API',
    uptime: process.uptime(),
  });
});

apiRouter.use('/auth', authRoutes);
apiRouter.use('/records', recordsRoutes);
apiRouter.use('/datasets', datasetsRoutes);
apiRouter.use('/import', importRoutes);
apiRouter.use('/export', exportRoutes);
apiRouter.use('/audit', auditRoutes);
apiRouter.use('/system', systemRoutes);
apiRouter.use('/backup', backupRoutes);
apiRouter.use('/data-quality', dataQualityRoutes);

// Mount on both /api and / to handle both direct and path-rewritten Vercel service routes
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Serve static client if production build exists
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

// Start server
async function startServer() {
  try {
    // 1. Run migrations and verify DB
    await runMigrations();

    // 2. Initialize scheduled database backups
    await initScheduledBackups();

    // 3. Bind server to host (0.0.0.0 for LAN access)
    app.listen(config.port, config.host, () => {
      console.log(`\n🚀 Server listening on ${config.host}:${config.port}`);
      printLanAccessInfo(config.port, 5173);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

// Export app for testing & Vercel
export default app;
export { app };

// If run directly
if (process.argv[1]?.endsWith('server.js')) {
  startServer();
}
