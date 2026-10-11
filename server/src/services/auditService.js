import { query } from '../db/index.js';

export async function logSearch({ userId, searchField, searchTerm, resultCount }) {
  try {
    await query(
      `INSERT INTO search_history (user_id, search_field, search_term, result_count) 
       VALUES ($1, $2, $3, $4)`,
      [userId || null, String(searchField || 'all'), String(searchTerm || ''), Number(resultCount || 0)]
    );
  } catch (err) {
    console.error('[AuditService] Failed to log search:', err.message);
  }
}

export async function logAudit({ userId, action, targetType, targetId, details = {} }) {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, target_type, target_id, details) 
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId || null,
        String(action),
        targetType ? String(targetType) : null,
        targetId ? String(targetId) : null,
        JSON.stringify(details || {})
      ]
    );
  } catch (err) {
    console.error('[AuditService] Failed to log audit event:', err.message);
  }
}

export async function getSearchHistory(limit = 50) {
  const sql = `
    SELECT 
      search_history.*,
      users.username
    FROM search_history
    LEFT JOIN users ON search_history.user_id = users.id
    ORDER BY search_history.created_at DESC
    LIMIT $1
  `;
  const res = await query(sql, [Math.min(100, Math.max(1, limit))]);
  return res.rows;
}

export async function getAuditLogs(limit = 100) {
  const sql = `
    SELECT 
      audit_logs.*,
      users.username
    FROM audit_logs
    LEFT JOIN users ON audit_logs.user_id = users.id
    ORDER BY audit_logs.created_at DESC
    LIMIT $1
  `;
  const res = await query(sql, [Math.min(200, Math.max(1, limit))]);
  return res.rows;
}

export async function clearSearchHistory(userId = null) {
  await query('DELETE FROM search_history', []);
  return { success: true };
}
