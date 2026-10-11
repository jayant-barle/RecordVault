import { query, withTransaction } from '../db/index.js';

/**
 * Creates a record version entry
 */
export async function createRecordVersion(clientOrQuery, {
  recordId,
  operation,
  snapshot,
  diff = {},
  userId = null,
  username = 'system'
}) {
  const q = clientOrQuery.query ? clientOrQuery : { query };

  const verRes = await q.query(
    'SELECT COALESCE(MAX(version_num), 0) + 1 as next_ver FROM record_versions WHERE record_id = $1',
    [recordId]
  );
  const nextVer = parseInt(verRes.rows[0].next_ver, 10);

  await q.query(`
    INSERT INTO record_versions (record_id, version_num, operation, snapshot, diff, user_id, username, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
  `, [
    recordId,
    nextVer,
    operation,
    JSON.stringify(snapshot || {}),
    JSON.stringify(diff || {}),
    userId,
    username
  ]);

  return nextVer;
}

/**
 * Retrieves all versions for a record
 */
export async function getRecordVersions(recordId) {
  const res = await query(`
    SELECT * FROM record_versions
    WHERE record_id = $1
    ORDER BY version_num DESC
  `, [recordId]);

  return res.rows.map(row => ({
    ...row,
    snapshot: typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : (row.snapshot || {}),
    diff: typeof row.diff === 'string' ? JSON.parse(row.diff) : (row.diff || {})
  }));
}

/**
 * Reverts a record to a specified historical version
 */
export async function undoRecordEdit(recordId, targetVersionNum, userId = null, username = 'system') {
  return await withTransaction(async (client) => {
    // 1. Fetch current active record
    const curRes = await client.query('SELECT * FROM records WHERE id = $1', [recordId]);
    if (curRes.rows.length === 0) {
      throw new Error(`Record ${recordId} not found.`);
    }
    const current = curRes.rows[0];

    // 2. Fetch the target historical version
    const verRes = await client.query(
      'SELECT * FROM record_versions WHERE record_id = $1 AND version_num = $2',
      [recordId, targetVersionNum]
    );
    if (verRes.rows.length === 0) {
      throw new Error(`Version #${targetVersionNum} does not exist for record ${recordId}.`);
    }
    const targetVer = verRes.rows[0];
    const targetSnapshot = typeof targetVer.snapshot === 'string' ? JSON.parse(targetVer.snapshot) : targetVer.snapshot;

    // 3. Build diff between current and proposed restoration
    const diff = {
      name: { from: current.name, to: targetSnapshot.name },
      mobile: { from: current.mobile, to: targetSnapshot.mobile },
      email: { from: current.email, to: targetSnapshot.email },
      company: { from: current.company, to: targetSnapshot.company },
      custom_fields: { from: current.custom_fields, to: targetSnapshot.custom_fields }
    };

    // 4. Update the record
    await client.query(`
      UPDATE records
      SET 
        name = $1,
        mobile = $2,
        email = $3,
        company = $4,
        custom_fields = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
    `, [
      targetSnapshot.name,
      targetSnapshot.mobile,
      targetSnapshot.email,
      targetSnapshot.company,
      JSON.stringify(targetSnapshot.custom_fields || {}),
      recordId
    ]);

    // 5. Create new version entry for the UNDO action
    await createRecordVersion(client, {
      recordId,
      operation: 'UNDO_RESTORE',
      snapshot: targetSnapshot,
      diff,
      userId,
      username
    });

    // 6. Audit log
    await client.query(`
      INSERT INTO audit_logs (user_id, username, action, target_type, target_id, details, ip_address, created_at)
      VALUES ($1, $2, 'UNDO_RECORD_EDIT', 'record', $3, $4, '127.0.0.1', CURRENT_TIMESTAMP)
    `, [userId, username, recordId, JSON.stringify({ revertedToVersion: targetVersionNum, diff })]);

    const updatedRes = await client.query('SELECT * FROM records WHERE id = $1', [recordId]);
    return {
      success: true,
      message: `Record successfully reverted to Version #${targetVersionNum}.`,
      record: updatedRes.rows[0],
      diff
    };
  });
}

/**
 * Soft deletes a record
 */
export async function softDeleteRecord(recordId, userId = null, username = 'system') {
  return await withTransaction(async (client) => {
    const curRes = await client.query('SELECT * FROM records WHERE id = $1 AND is_deleted = FALSE', [recordId]);
    if (curRes.rows.length === 0) {
      throw new Error(`Record ${recordId} not found or already deleted.`);
    }
    const current = curRes.rows[0];

    // Mark as soft deleted
    await client.query(`
      UPDATE records
      SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP, deleted_by = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [userId, recordId]);

    // Record version
    await createRecordVersion(client, {
      recordId,
      operation: 'SOFT_DELETE',
      snapshot: current,
      userId,
      username
    });

    // Update dataset count
    await client.query(`
      UPDATE datasets
      SET record_count = (SELECT COUNT(*) FROM records WHERE dataset_id = $1 AND is_deleted = FALSE),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [current.dataset_id]);

    // Audit log
    await client.query(`
      INSERT INTO audit_logs (user_id, username, action, target_type, target_id, details, ip_address, created_at)
      VALUES ($1, $2, 'SOFT_DELETE_RECORD', 'record', $3, $4, '127.0.0.1', CURRENT_TIMESTAMP)
    `, [userId, username, recordId, JSON.stringify({ excel_id: current.excel_id, name: current.name })]);

    return { success: true, message: `Record ${current.excel_id} moved to deleted records.` };
  });
}

/**
 * Restores a soft-deleted record
 */
export async function restoreDeletedRecord(recordId, userId = null, username = 'system') {
  return await withTransaction(async (client) => {
    const delRes = await client.query('SELECT * FROM records WHERE id = $1 AND is_deleted = TRUE', [recordId]);
    if (delRes.rows.length === 0) {
      throw new Error(`Deleted record ${recordId} not found.`);
    }
    const deletedRecord = delRes.rows[0];

    // Check if an active record with the same (dataset_id, excel_id) already exists
    const conflictRes = await client.query(`
      SELECT id FROM records
      WHERE dataset_id = $1 AND excel_id = $2 AND is_deleted = FALSE
    `, [deletedRecord.dataset_id, deletedRecord.excel_id]);

    if (conflictRes.rows.length > 0) {
      throw new Error(`Cannot restore record: An active record with Excel ID "${deletedRecord.excel_id}" already exists in this dataset.`);
    }

    // Restore
    await client.query(`
      UPDATE records
      SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [recordId]);

    // Record version
    await createRecordVersion(client, {
      recordId,
      operation: 'RESTORE_DELETED',
      snapshot: deletedRecord,
      userId,
      username
    });

    // Update dataset count
    await client.query(`
      UPDATE datasets
      SET record_count = (SELECT COUNT(*) FROM records WHERE dataset_id = $1 AND is_deleted = FALSE),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [deletedRecord.dataset_id]);

    // Audit log
    await client.query(`
      INSERT INTO audit_logs (user_id, username, action, target_type, target_id, details, ip_address, created_at)
      VALUES ($1, $2, 'RESTORE_RECORD', 'record', $3, $4, '127.0.0.1', CURRENT_TIMESTAMP)
    `, [userId, username, recordId, JSON.stringify({ excel_id: deletedRecord.excel_id, name: deletedRecord.name })]);

    return { success: true, message: `Record ${deletedRecord.excel_id} restored successfully.` };
  });
}

/**
 * Permanently deletes a record
 */
export async function permanentlyDeleteRecord(recordId, userId = null, username = 'system') {
  return await withTransaction(async (client) => {
    const curRes = await client.query('SELECT * FROM records WHERE id = $1', [recordId]);
    if (curRes.rows.length === 0) {
      throw new Error(`Record ${recordId} not found.`);
    }
    const current = curRes.rows[0];

    await client.query('DELETE FROM record_versions WHERE record_id = $1', [recordId]);
    await client.query('DELETE FROM records WHERE id = $1', [recordId]);

    // Update dataset count
    await client.query(`
      UPDATE datasets
      SET record_count = (SELECT COUNT(*) FROM records WHERE dataset_id = $1 AND is_deleted = FALSE),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [current.dataset_id]);

    // Audit log
    await client.query(`
      INSERT INTO audit_logs (user_id, username, action, target_type, target_id, details, ip_address, created_at)
      VALUES ($1, $2, 'PERMANENT_DELETE_RECORD', 'record', $3, $4, '127.0.0.1', CURRENT_TIMESTAMP)
    `, [userId, username, recordId, JSON.stringify({ excel_id: current.excel_id, name: current.name })]);

    return { success: true, message: `Record ${current.excel_id} permanently deleted.` };
  });
}
