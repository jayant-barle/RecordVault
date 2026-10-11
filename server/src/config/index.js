import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  host: process.env.HOST || '0.0.0.0', // LAN-accessible binding
  jwtSecret: process.env.JWT_SECRET || 'excel_mgmt_secure_jwt_secret_dev_2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  databaseUrl: process.env.DATABASE_URL || '',
  dataDir: process.env.DATA_DIR || path.resolve(__dirname, '../../data'),
  clientUrl: process.env.CLIENT_SERVICE_URL || process.env.CLIENT_URL || 'http://localhost:5173',
  isProduction: process.env.NODE_ENV === 'production',
  maxUploadSizeBytes: 50 * 1024 * 1024, // 50MB
};
