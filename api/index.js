import { app } from '../server/src/server.js';
import { runMigrations } from '../server/src/db/migrations.js';

let isInitialized = false;
let initPromise = null;

async function ensureInitialized() {
  if (isInitialized) return;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await runMigrations();
        console.log('✅ Serverless DB migrations verified.');
      } catch (err) {
        console.warn('⚠️ Serverless DB migration init warning:', err.message);
      }
      isInitialized = true;
    })();
  }
  return initPromise;
}

export default async function handler(req, res) {
  await ensureInitialized();
  return app(req, res);
}
