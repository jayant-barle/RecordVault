import crypto from 'crypto';
import { withTransaction, query } from '../db/index.js';

export async function executeImport({
  records,
  filename,
  worksheet,
  mode = 'merge', // 'replace' or 'merge'
  datasetId = null,
  datasetName = null,
  userId = null,
  username = 'system',
  ipAddress = '127.0.0.1',
}) {
  if (!records || !Array.isArray(records)) {
    throw new Error('No records provided for import.');
  }

  const importJobId = crypto.randomUUID();
  const resolvedDatasetId = datasetId || crypto.randomUUID();
  const resolvedDatasetName = datasetName || `${filename} - ${worksheet || 'Sheet1'}`;

  return await withTransaction(async (client) => {
    // 1. Ensure target dataset exists
    const dsCheck = await client.query('SELECT id, name FROM datasets WHERE id = $1', [resolvedDatasetId]);
    if (dsCheck.rows.length === 0) {
      await client.query(`
        INSERT INTO datasets (id, name, source_filename, worksheet_name, record_count, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [resolvedDatasetId, resolvedDatasetName, filename, worksheet]);
    } else {
      await client.query(`
        UPDATE datasets 
        SET source_filename = $1, worksheet_name = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [filename, worksheet, resolvedDatasetId]);
    }

    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const errors = [];

    // 2. If mode is 'replace', delete all existing records in this specific dataset only
    if (mode === 'replace') {
      await client.query('DELETE FROM records WHERE dataset_id = $1', [resolvedDatasetId]);
    }

    // 3. Track seen IDs within this import batch to detect duplicates within upload
    const seenBatchIds = new Set();

    for (const record of records) {
      const excelId = String(record.excel_id || '').trim();

      // Check for empty ID
      if (!excelId) {
        skippedCount++;
        errors.push({
          row: record._rowNumber || null,
          id: '(empty)',
          reason: 'Skipped: Missing required Excel ID.',
        });
        continue;
      }

      // Check for duplicate ID within the same upload batch
      if (seenBatchIds.has(excelId)) {
        skippedCount++;
        errors.push({
          row: record._rowNumber || null,
          id: excelId,
          reason: 'Skipped: Duplicate ID encountered earlier in the same file.',
        });
        continue;
      }
      seenBatchIds.add(excelId);

      const name = String(record.name || '').trim();
      const mobile = String(record.mobile || '').trim();
      const email = String(record.email || '').trim();
      const company = String(record.company || '').trim();
      const customFieldsJson = JSON.stringify(record.custom_fields || {});

      try {
        if (mode === 'replace') {
          // In replace mode, we already wiped the dataset, so insert directly
          const newRecordId = crypto.randomUUID();
          await client.query(`
            INSERT INTO records (id, dataset_id, excel_id, name, mobile, email, company, custom_fields, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `, [newRecordId, resolvedDatasetId, excelId, name, mobile, email, company, customFieldsJson]);
          insertedCount++;
        } else {
          // Merge mode: check if record already exists in dataset
          const existing = await client.query(
            'SELECT id, custom_fields FROM records WHERE dataset_id = $1 AND excel_id = $2',
            [resolvedDatasetId, excelId]
          );

          if (existing.rows.length > 0) {
            // Update matching record, merging custom fields
            const existingRecord = existing.rows[0];
            const existingCustom = typeof existingRecord.custom_fields === 'string'
              ? JSON.parse(existingRecord.custom_fields)
              : (existingRecord.custom_fields || {});
            
            const mergedCustom = { ...existingCustom, ...(record.custom_fields || {}) };

            await client.query(`
              UPDATE records
              SET name = $1, mobile = $2, email = $3, company = $4, custom_fields = $5, updated_at = CURRENT_TIMESTAMP
              WHERE id = $6
            `, [name, mobile, email, company, JSON.stringify(mergedCustom), existingRecord.id]);
            updatedCount++;
          } else {
            // Insert new record
            const newRecordId = crypto.randomUUID();
            await client.query(`
              INSERT INTO records (id, dataset_id, excel_id, name, mobile, email, company, custom_fields, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [newRecordId, resolvedDatasetId, excelId, name, mobile, email, company, customFieldsJson]);
            insertedCount++;
          }
        }
      } catch (err) {
        failedCount++;
        errors.push({
          row: record._rowNumber || null,
          id: excelId,
          reason: `Database error: ${err.message}`,
        });
      }
    }

    // 4. Update dataset record count
    const totalCountRes = await client.query(
      'SELECT COUNT(*) as count FROM records WHERE dataset_id = $1',
      [resolvedDatasetId]
    );
    const finalRecordCount = parseInt(totalCountRes.rows[0].count, 10);
    await client.query('UPDATE datasets SET record_count = $1 WHERE id = $2', [finalRecordCount, resolvedDatasetId]);

    // 5. Save import job record
    await client.query(`
      INSERT INTO import_jobs (
        id, user_id, filename, worksheet, dataset_id, mode,
        total_processed, inserted, updated, skipped, failed, errors, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
    `, [
      importJobId,
      userId,
      filename,
      worksheet,
      resolvedDatasetId,
      mode,
      records.length,
      insertedCount,
      updatedCount,
      skippedCount,
      failedCount,
      JSON.stringify(errors),
      failedCount > 0 && insertedCount === 0 && updatedCount === 0 ? 'failed' : 'completed',
    ]);

    // 6. Audit log entry
    await client.query(`
      INSERT INTO audit_logs (user_id, username, action, target_type, target_id, details, ip_address, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
    `, [
      userId,
      username,
      'IMPORT_EXCEL',
      'dataset',
      resolvedDatasetId,
      JSON.stringify({
        filename,
        worksheet,
        mode,
        totalProcessed: records.length,
        inserted: insertedCount,
        updated: updatedCount,
        skipped: skippedCount,
        failed: failedCount,
      }),
      ipAddress,
    ]);

    return {
      importJobId,
      datasetId: resolvedDatasetId,
      datasetName: resolvedDatasetName,
      filename,
      worksheet,
      mode,
      totalProcessed: records.length,
      inserted: insertedCount,
      updated: updatedCount,
      skipped: skippedCount,
      failed: failedCount,
      errors,
      finalRecordCount,
    };
  });
}
