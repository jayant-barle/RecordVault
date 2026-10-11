import { query, withTransaction } from '../db/index.js';
import { logAudit } from './auditService.js';

export async function getRecordById(id) {
  const sql = `
    SELECT 
      records.*,
      datasets.name as dataset_name,
      datasets.filename as source_file,
      datasets.sheet_name as sheet_name
    FROM records
    LEFT JOIN datasets ON records.dataset_id = datasets.id
    WHERE records.id = $1
  `;
  const res = await query(sql, [Number(id)]);
  if (res.rows.length === 0) {
    return null;
  }
  return res.rows[0];
}

export async function updateRecord(id, updates, userId = null) {
  const current = await getRecordById(id);
  if (!current) {
    throw new Error(`Record with ID ${id} not found.`);
  }

  const { name, phone, email, company_department, custom_fields } = updates;

  // Protect excel_id: do not allow altering excel_id arbitrarily to break identity
  const updatedCustom = custom_fields !== undefined ? (typeof custom_fields === 'string' ? JSON.parse(custom_fields) : custom_fields) : current.custom_fields;

  const sql = `
    UPDATE records
    SET 
      name = $1,
      phone = $2,
      email = $3,
      company_department = $4,
      custom_fields = $5,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $6
    RETURNING *
  `;

  const res = await query(sql, [
    name !== undefined ? String(name).trim() : current.name,
    phone !== undefined ? String(phone).trim() : current.phone,
    email !== undefined ? String(email).trim() : current.email,
    company_department !== undefined ? String(company_department).trim() : current.company_department,
    JSON.stringify(updatedCustom || {}),
    Number(id)
  ]);

  const updated = res.rows[0];

  await logAudit({
    userId,
    action: 'UPDATE_RECORD',
    targetType: 'record',
    targetId: String(id),
    details: {
      excel_id: current.excel_id,
      previous: {
        name: current.name,
        phone: current.phone,
        email: current.email,
        company_department: current.company_department
      },
      updated: {
        name: updated.name,
        phone: updated.phone,
        email: updated.email,
        company_department: updated.company_department
      }
    }
  });

  return updated;
}

export async function deleteRecord(id, userId = null) {
  const current = await getRecordById(id);
  if (!current) {
    throw new Error(`Record with ID ${id} not found.`);
  }

  const result = await withTransaction(async (client) => {
    await client.query('DELETE FROM records WHERE id = $1', [Number(id)]);
    
    // Decrement dataset count
    if (current.dataset_id) {
      await client.query(
        'UPDATE datasets SET record_count = GREATEST(0, record_count - 1), updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [current.dataset_id]
      );
    }

    await logAudit({
      userId,
      action: 'DELETE_RECORD',
      targetType: 'record',
      targetId: String(id),
      details: {
        excel_id: current.excel_id,
        name: current.name,
        dataset_id: current.dataset_id
      }
    });

    return { success: true, deletedId: id, excel_id: current.excel_id };
  });

  return result;
}

export async function deleteBulkRecords(ids, userId = null) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('No record IDs provided for deletion.');
  }

  const numIds = ids.map(Number);
  
  const result = await withTransaction(async (client) => {
    // Collect dataset IDs to recalculate counts
    const recs = await client.query('SELECT DISTINCT dataset_id FROM records WHERE id = ANY($1)', [numIds]);
    
    await client.query('DELETE FROM records WHERE id = ANY($1)', [numIds]);

    for (const r of recs.rows) {
      if (r.dataset_id) {
        const cRes = await client.query('SELECT COUNT(*) as count FROM records WHERE dataset_id = $1', [r.dataset_id]);
        await client.query('UPDATE datasets SET record_count = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
          parseInt(cRes.rows[0].count, 10),
          r.dataset_id
        ]);
      }
    }

    await logAudit({
      userId,
      action: 'BULK_DELETE_RECORDS',
      targetType: 'record',
      targetId: `Count: ${numIds.length}`,
      details: { deletedIds: numIds }
    });

    return { success: true, count: numIds.length };
  });

  return result;
}
