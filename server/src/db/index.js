import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { config } from '../config/index.js';

let dbInstance = null;
let isPgPool = false;

export async function getDb() {
  if (dbInstance) return dbInstance;

  if (config.databaseUrl) {
    try {
      console.log('🔗 Attempting to connect to PostgreSQL server via DATABASE_URL...');
      const pool = new pg.Pool({ connectionString: config.databaseUrl });
      // Test connectivity
      await pool.query('SELECT 1');
      console.log('✅ Successfully connected to external PostgreSQL server.');
      dbInstance = pool;
      isPgPool = true;
      return dbInstance;
    } catch (err) {
      console.warn('⚠️ Could not connect to external PostgreSQL server:', err.message);
      console.log('🔄 Falling back to embedded persistent PostgreSQL engine (PGlite)...');
    }
  }

  if (process.env.NODE_ENV === 'test') {
    const pglite = new PGlite();
    await pglite.waitReady;
    dbInstance = pglite;
    isPgPool = false;
    return dbInstance;
  }

  // Ensure data directory exists
  if (!fs.existsSync(config.dataDir)) {
    fs.mkdirSync(config.dataDir, { recursive: true });
  }

  const pglitePath = path.join(config.dataDir, 'pglite');
  // In case of an abrupt termination on Windows, clean up stale postmaster.pid lock file
  const pidFile = path.join(pglitePath, 'postmaster.pid');
  if (fs.existsSync(pidFile)) {
    try {
      fs.unlinkSync(pidFile);
      console.log('🧹 Cleaned up stale PostgreSQL postmaster.pid lock.');
    } catch (err) {
      console.warn('⚠️ Could not clean postmaster.pid:', err.message);
    }
  }

  console.log(`💾 Initializing embedded persistent PostgreSQL at: ${pglitePath}`);
  const pglite = new PGlite(pglitePath);
  await pglite.waitReady;
  console.log('✅ Embedded persistent PostgreSQL engine ready.');
  dbInstance = pglite;
  isPgPool = false;
  return dbInstance;
}

export async function query(text, params = []) {
  const db = await getDb();
  if (isPgPool) {
    return await db.query(text, params);
  } else {
    // PGlite returns { rows, affectedRows, fields, ... }
    const result = await db.query(text, params);
    return {
      rows: result.rows || [],
      rowCount: result.affectedRows ?? (result.rows ? result.rows.length : 0),
      fields: result.fields || []
    };
  }
}

export async function withTransaction(callback) {
  const db = await getDb();
  if (isPgPool) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else {
    // PGlite transaction support
    return await db.transaction(async (tx) => {
      // tx has .query(sql, params)
      const wrappedTx = {
        query: async (sql, params = []) => {
          const res = await tx.query(sql, params);
          return {
            rows: res.rows || [],
            rowCount: res.affectedRows ?? (res.rows ? res.rows.length : 0)
          };
        }
      };
      return await callback(wrappedTx);
    });
  }
}

export function isUsingExternalPg() {
  return isPgPool;
}

export function getDbMode() {
  return isPgPool ? 'external_postgresql' : 'embedded_pglite';
}
