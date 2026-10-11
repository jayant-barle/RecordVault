import crypto from 'crypto';
import { withTransaction, query } from '../db/index.js';
import { createRecordVersion } from './recordService.js';

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

    // 2. Pre-create import_jobs record to satisfy foreign key constraints on import_journal
    await client.query(`
      INSERT INTO import_jobs (
        id, user_id, filename, worksheet, dataset_id, mode,
        total_processed, inserted, updated, skipped, failed, errors, status, stage, can_rollback, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0, 0, 0, '[]'::jsonb, 'in_progress', 'processing', TRUE, CURRENT_TIMESTAMP)
    `, [importJobId, userId, filename, worksheet, resolvedDatasetId, mode, records.length]);

    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const errors = [];

    // 2. If mode is 'replace', capture all existing records in this dataset before deletion for journal rollback
    if (mode === 'replace') {
      const existingInDataset = await client.query(
        'SELECT * FROM records WHERE dataset_id = $1 AND is_deleted = FALSE',
        [resolvedDatasetId]
      );
      for (const rec of existingInDataset.rows) {
        await client.query(`
          INSERT INTO import_journal (import_job_id, action_type, record_id, dataset_id, previous_data, created_at)
          VALUES ($1, 'REPLACE_DELETE', $2, $3, $4, CURRENT_TIMESTAMP)
        `, [importJobId, rec.id, resolvedDatasetId, JSON.stringify(rec)]);
      }
      await client.query('DELETE FROM records WHERE dataset_id = $1', [resolvedDatasetId]);
    }

    // 3. Track seen IDs within this import batch to detect duplicates within upload
    const seenBatchIds = new Set();

    for (const record of records) {
      const excelId = String(record.excel_id || '').trim();

      // Check for empty ID
      if (!excelId) {
        skippedCount++;
        const msg = 'Row skipped: Missing required business Excel ID.';
        errors.push({
          row: record._rowNumber || null,
          excel_id: '(empty)',
          id: '(empty)',
          column: 'Employee ID / Business ID',
          category: 'MISSING_ID',
          message: msg,
          reason: msg,
          suggested_fix: 'Ensure the ID column contains a unique identifier string.',
        });
        continue;
      }

      // Check for duplicate ID within the same upload batch
      if (seenBatchIds.has(excelId)) {
        skippedCount++;
        const msg = `Row skipped: Duplicate ID "${excelId}" encountered earlier in the same workbook.`;
        errors.push({
          row: record._rowNumber || null,
          excel_id: excelId,
          id: excelId,
          column: 'Employee ID / Business ID',
          category: 'DUPLICATE_ID_IN_UPLOAD',
          message: msg,
          reason: msg,
          suggested_fix: 'Verify row is not an accidental copy or deduplicate source sheet.',
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
          const newRecordId = crypto.randomUUID();
          await client.query(`
            INSERT INTO records (id, dataset_id, excel_id, name, mobile, email, company, custom_fields, is_deleted, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `, [newRecordId, resolvedDatasetId, excelId, name, mobile, email, company, customFieldsJson]);

          // Journal entry
          await client.query(`
            INSERT INTO import_journal (import_job_id, action_type, record_id, dataset_id, previous_data, created_at)
            VALUES ($1, 'INSERT', $2, $3, NULL, CURRENT_TIMESTAMP)
          `, [importJobId, newRecordId, resolvedDatasetId]);

          // Initial version snapshot
          await createRecordVersion(client, {
            recordId: newRecordId,
            operation: 'IMPORT_CREATE',
            snapshot: { id: newRecordId, dataset_id: resolvedDatasetId, excel_id: excelId, name, mobile, email, company, custom_fields: record.custom_fields || {} },
            userId,
            username
          });

          insertedCount++;
        } else {
          // Merge mode: check if record already exists in dataset
          const existing = await client.query(
            'SELECT * FROM records WHERE dataset_id = $1 AND excel_id = $2',
            [resolvedDatasetId, excelId]
          );

          if (existing.rows.length > 0) {
            const existingRecord = existing.rows[0];
            const existingCustom = typeof existingRecord.custom_fields === 'string'
              ? JSON.parse(existingRecord.custom_fields)
              : (existingRecord.custom_fields || {});
            
            const mergedCustom = { ...existingCustom, ...(record.custom_fields || {}) };

            // Journal previous state before update
            await client.query(`
              INSERT INTO import_journal (import_job_id, action_type, record_id, dataset_id, previous_data, created_at)
              VALUES ($1, 'UPDATE', $2, $3, $4, CURRENT_TIMESTAMP)
            `, [importJobId, existingRecord.id, resolvedDatasetId, JSON.stringify(existingRecord)]);

            // Record version
            await createRecordVersion(client, {
              recordId: existingRecord.id,
              operation: 'IMPORT_UPDATE',
              snapshot: existingRecord,
              diff: {
                name: { from: existingRecord.name, to: name },
                mobile: { from: existingRecord.mobile, to: mobile },
                email: { from: existingRecord.email, to: email },
                company: { from: existingRecord.company, to: company },
              },
              userId,
              username
            });

            await client.query(`
              UPDATE records
              SET name = $1, mobile = $2, email = $3, company = $4, custom_fields = $5, is_deleted = FALSE, updated_at = CURRENT_TIMESTAMP
              WHERE id = $6
            `, [name, mobile, email, company, JSON.stringify(mergedCustom), existingRecord.id]);
            updatedCount++;
          } else {
            // Insert new record
            const newRecordId = crypto.randomUUID();
            await client.query(`
              INSERT INTO records (id, dataset_id, excel_id, name, mobile, email, company, custom_fields, is_deleted, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [newRecordId, resolvedDatasetId, excelId, name, mobile, email, company, customFieldsJson]);

            // Journal entry
            await client.query(`
              INSERT INTO import_journal (import_job_id, action_type, record_id, dataset_id, previous_data, created_at)
              VALUES ($1, 'INSERT', $2, $3, NULL, CURRENT_TIMESTAMP)
            `, [importJobId, newRecordId, resolvedDatasetId]);

            // Initial version snapshot
            await createRecordVersion(client, {
              recordId: newRecordId,
              operation: 'IMPORT_CREATE',
              snapshot: { id: newRecordId, dataset_id: resolvedDatasetId, excel_id: excelId, name, mobile, email, company, custom_fields: record.custom_fields || {} },
              userId,
              username
            });

            insertedCount++;
          }
        }
      } catch (err) {
        failedCount++;
        errors.push({
          row: record._rowNumber || null,
          excel_id: excelId,
          id: excelId,
          column: 'GENERAL',
          category: 'DATABASE_ERROR',
          message: `Database error: ${err.message}`,
          reason: `Database error: ${err.message}`,
          suggested_fix: 'Check for unexpected constraints or schema limits.',
        });
      }
    }

    // 4. Update dataset record count
    const totalCountRes = await client.query(
      'SELECT COUNT(*) as count FROM records WHERE dataset_id = $1 AND is_deleted = FALSE',
      [resolvedDatasetId]
    );
    const finalRecordCount = parseInt(totalCountRes.rows[0].count, 10);
    await client.query('UPDATE datasets SET record_count = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [finalRecordCount, resolvedDatasetId]);

    // 5. Finalize import job record
    const status = failedCount > 0 && insertedCount === 0 && updatedCount === 0 ? 'failed' : 'completed';
    await client.query(`
      UPDATE import_jobs
      SET total_processed = $1, inserted = $2, updated = $3, skipped = $4, failed = $5, errors = $6, status = $7, stage = 'completed'
      WHERE id = $8
    `, [
      records.length,
      insertedCount,
      updatedCount,
      skippedCount,
      failedCount,
      JSON.stringify(errors),
      status,
      importJobId
    ]);

    // 6. Audit log entry
    await client.query(`
      INSERT INTO audit_logs (user_id, username, action, target_type, target_id, details, ip_address, created_at)
      VALUES ($1, $2, 'IMPORT_EXCEL', 'dataset', $3, $4, $5, CURRENT_TIMESTAMP)
    `, [
      userId,
      username,
      resolvedDatasetId,
      JSON.stringify({
        importJobId,
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

/**
 * Rolls back an import job atomically
 */
export async function rollbackImport(jobId, userId = null, username = 'system') {
  return await withTransaction(async (client) => {
    // 1. Fetch import job
    const jobRes = await client.query('SELECT * FROM import_jobs WHERE id = $1', [jobId]);
    if (jobRes.rows.length === 0) {
      throw new Error(`Import job "${jobId}" not found.`);
    }
    const job = jobRes.rows[0];

    if (job.status === 'rolled_back') {
      throw new Error(`Import job "${jobId}" has already been rolled back.`);
    }

    if (!job.can_rollback) {
      throw new Error(`Import job "${jobId}" cannot be rolled back.`);
    }

    // 2. Fetch journal entries
    const journalRes = await client.query(
      'SELECT * FROM import_journal WHERE import_job_id = $1 ORDER BY id DESC',
      [jobId]
    );

    let removedInserts = 0;
    let restoredUpdates = 0;
    let restoredReplaces = 0;
    const warnings = [];

    for (const entry of journalRes.rows) {
      const prevData = entry.previous_data
        ? (typeof entry.previous_data === 'string' ? JSON.parse(entry.previous_data) : entry.previous_data)
        : null;

      if (entry.action_type === 'INSERT') {
        // Check if user made subsequent edits to this record
        const laterEdits = await client.query(`
          SELECT COUNT(*) as count FROM record_versions
          WHERE record_id = $1 AND operation = 'UPDATE' AND created_at > $2
        `, [entry.record_id, job.created_at]);

        if (parseInt(laterEdits.rows[0].count, 10) > 0) {
          warnings.push(`Record ${entry.record_id} was modified after import; proceeding with rollback deletion as requested.`);
        }

        // Delete versions and record
        await client.query('DELETE FROM record_versions WHERE record_id = $1', [entry.record_id]);
        await client.query('DELETE FROM records WHERE id = $1', [entry.record_id]);
        removedInserts++;
      } else if (entry.action_type === 'UPDATE' && prevData) {
        // Restore previous field values
        const cf = typeof prevData.custom_fields === 'string' ? prevData.custom_fields : JSON.stringify(prevData.custom_fields || {});
        await client.query(`
          UPDATE records
          SET name = $1, mobile = $2, email = $3, company = $4, custom_fields = $5, updated_at = CURRENT_TIMESTAMP
          WHERE id = $6
        `, [prevData.name, prevData.mobile, prevData.email, prevData.company, cf, entry.record_id]);
        restoredUpdates++;
      } else if (entry.action_type === 'REPLACE_DELETE' && prevData) {
        // Re-insert record that was removed in Replace mode
        const cf = typeof prevData.custom_fields === 'string' ? prevData.custom_fields : JSON.stringify(prevData.custom_fields || {});
        await client.query(`
          INSERT INTO records (id, dataset_id, excel_id, name, mobile, email, company, custom_fields, is_deleted, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
          ON CONFLICT (id) DO NOTHING
        `, [prevData.id, prevData.dataset_id, prevData.excel_id, prevData.name, prevData.mobile, prevData.email, prevData.company, cf, prevData.is_deleted || false, prevData.created_at]);
        restoredReplaces++;
      }
    }

    // 3. Recalculate dataset record count
    if (job.dataset_id) {
      await client.query(`
        UPDATE datasets
        SET record_count = (SELECT COUNT(*) FROM records WHERE dataset_id = $1 AND is_deleted = FALSE),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [job.dataset_id]);
    }

    // 4. Update import job status
    await client.query(`
      UPDATE import_jobs
      SET status = 'rolled_back', can_rollback = FALSE, rolled_back_at = CURRENT_TIMESTAMP, rolled_back_by = $1
      WHERE id = $2
    `, [userId, jobId]);

    // 5. Audit log
    await client.query(`
      INSERT INTO audit_logs (user_id, username, action, target_type, target_id, details, ip_address, created_at)
      VALUES ($1, $2, 'ROLLBACK_IMPORT', 'import_job', $3, $4, '127.0.0.1', CURRENT_TIMESTAMP)
    `, [
      userId,
      username,
      jobId,
      JSON.stringify({
        filename: job.filename,
        worksheet: job.worksheet,
        removedInserts,
        restoredUpdates,
        restoredReplaces,
        warnings
      })
    ]);

    return {
      success: true,
      message: `Import "${job.filename}" successfully rolled back. Removed ${removedInserts} inserted records, restored ${restoredUpdates} updated records, and restored ${restoredReplaces} replaced records.`,
      removedInserts,
      restoredUpdates,
      restoredReplaces,
      warnings
    };
  });
}

/**
 * Generates CSV string of import error report
 */
export async function generateErrorReportCsv(jobId) {
  const jobRes = await query('SELECT * FROM import_jobs WHERE id = $1', [jobId]);
  if (jobRes.rows.length === 0) {
    throw new Error('Import job not found.');
  }
  const job = jobRes.rows[0];
  const errors = typeof job.errors === 'string' ? JSON.parse(job.errors) : (job.errors || []);

  const headers = ['File', 'Worksheet', 'Excel Row', 'Excel ID', 'Column', 'Error Category', 'Error Message', 'Suggested Correction'];
  const lines = [headers.join(',')];

  for (const err of errors) {
    const row = [
      `"${job.filename}"`,
      `"${job.worksheet || 'Sheet1'}"`,
      `"${err.row || '-'}"`,
      `"${err.excel_id || err.id || '-'}"`,
      `"${err.column || '-'}"`,
      `"${err.category || 'VALIDATION_ERROR'}"`,
      `"${String(err.message || err.reason || '').replace(/"/g, '""')}"`,
      `"${String(err.suggested_fix || 'Review and verify row values in workbook').replace(/"/g, '""')}"`
    ];
    lines.push(row.join(','));
  }

  return lines.join('\n');
}
