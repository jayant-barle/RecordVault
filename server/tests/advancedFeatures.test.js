import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { runMigrations } from '../src/db/migrations.js';
import { query } from '../src/db/index.js';
import { createBackup, restoreBackup } from '../src/services/backupService.js';
import { createRecordVersion, undoRecordEdit, softDeleteRecord, restoreDeletedRecord, getRecordVersions } from '../src/services/recordService.js';
import { rollbackImport, executeImport, generateErrorReportCsv } from '../src/services/importService.js';
import { searchRecords } from '../src/services/searchService.js';
import { generateExcelExport, generatePdfExport } from '../src/services/exportService.js';
import { runDataQualityAnalysis, generateDataQualityCsv } from '../src/services/dataQualityService.js';

process.env.NODE_ENV = 'test';

test('Advanced Nine Features Suite', async (t) => {
  await runMigrations();

  // Seed sample dataset and records for testing
  const testDatasetId = 'ds-advanced-test-01';
  await query(`
    INSERT INTO datasets (id, name, source_filename, worksheet_name, record_count, created_at, updated_at)
    VALUES ($1, 'Advanced Test Dataset', 'test.xlsx', 'Sheet1', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO NOTHING
  `, [testDatasetId]);

  let recordAId = null;

  await t.test('Feature 2: Soft delete and deleted-records recovery', async () => {
    // Insert a test record
    recordAId = crypto.randomUUID();
    await query(`
      INSERT INTO records (id, dataset_id, excel_id, name, mobile, email, company, is_deleted)
      VALUES ($1, $2, 'REC-001', 'Alice SoftDelete', '9876543210', 'alice@test.com', 'QA Team', FALSE)
    `, [recordAId, testDatasetId]);

    // Soft delete
    const delResult = await softDeleteRecord(recordAId, 1, 'admin');
    assert.strictEqual(delResult.success, true);

    // Verify record is excluded from normal search
    const searchRes = await searchRecords({ q: 'REC-001', field: 'excel_id' });
    const recordsList = searchRes.records || searchRes.data || [];
    assert.strictEqual(recordsList.length, 0, 'Soft deleted record must not appear in normal search');

    // Restore record
    const restoreResult = await restoreDeletedRecord(recordAId, 1, 'admin');
    assert.strictEqual(restoreResult.success, true);

    // Verify record is visible again
    const searchRestored = await searchRecords({ q: 'REC-001', field: 'excel_id' });
    const restoredList = searchRestored.records || searchRestored.data || [];
    assert.strictEqual(restoredList.length, 1, 'Restored record must appear in search results');
    assert.strictEqual(restoredList[0].name, 'Alice SoftDelete');
  });

  await t.test('Feature 2: Record edit version snapshotting and undo reversal', async () => {
    // Create initial snapshot
    await createRecordVersion({ query }, {
      recordId: recordAId,
      operation: 'UPDATE',
      snapshot: { id: recordAId, dataset_id: testDatasetId, excel_id: 'REC-001', name: 'Alice Original', mobile: '9876543210', email: 'alice@test.com', company: 'Engineering' },
      diff: { name: { from: 'Alice Original', to: 'Alice Modified' } },
      userId: 1,
      username: 'admin'
    });

    // Update current active record
    await query(`UPDATE records SET name = 'Alice Modified' WHERE id = $1`, [recordAId]);

    // Inspect versions
    const versions = await getRecordVersions(recordAId);
    assert.ok(versions.length >= 1);
    const targetVersion = versions[0];

    // Undo edit to historical version
    const undoRes = await undoRecordEdit(recordAId, targetVersion.version_num, 1, 'admin');
    assert.strictEqual(undoRes.success, true);
    assert.strictEqual(undoRes.record.name, 'Alice Original');

    // Verify in database
    const verifyRes = await query('SELECT name FROM records WHERE id = $1', [recordAId]);
    assert.strictEqual(verifyRes.rows[0].name, 'Alice Original');
  });

  await t.test('Feature 1: Database backup snapshot creation, safety backup, and restore', async () => {
    // Create manual backup
    const backupRes = await createBackup({ backupType: 'manual', userId: 1, username: 'admin' });
    assert.ok(backupRes.filename.endsWith('.json'));
    assert.ok(backupRes.jobId);

    // Restore from backup
    const restoreRes = await restoreBackup({ backupId: backupRes.jobId, userId: 1, username: 'admin' });
    assert.strictEqual(restoreRes.success, true);
    assert.ok(restoreRes.safetyBackup, 'Must record pre-restore safety snapshot before applying restore');
  });

  await t.test('Feature 3: Import history change journaling and atomic rollback', async () => {
    const importPayload = [
      { excel_id: 'RB-001', name: 'Bob Rollback', mobile: '1112223334', email: 'bob@rb.com', company: 'Rollback Team' },
      { excel_id: 'RB-002', name: 'Carol Rollback', mobile: '2223334445', email: 'carol@rb.com', company: 'Rollback Team' },
    ];

    const importRes = await executeImport({
      records: importPayload,
      filename: 'rollback_test.xlsx',
      worksheet: 'Sheet1',
      mode: 'merge',
      datasetId: testDatasetId,
      datasetName: 'Advanced Test Dataset',
      userId: 1,
      username: 'admin'
    });

    assert.strictEqual(importRes.inserted, 2);

    // Rollback the import
    const rollbackRes = await rollbackImport(importRes.importJobId, 1, 'admin');
    assert.strictEqual(rollbackRes.success, true);
    assert.strictEqual(rollbackRes.removedInserts, 2, 'Should cleanly remove the 2 inserted records');

    // Verify rollback records are removed from active records
    const checkDeleted = await query(`SELECT COUNT(*) as count FROM records WHERE excel_id IN ('RB-001', 'RB-002')`);
    assert.strictEqual(parseInt(checkDeleted.rows[0].count, 10), 0);
  });

  await t.test('Feature 4: Advanced multi-criteria search with AND / OR and custom fields', async () => {
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();

    // Insert two distinct records
    await query(`
      INSERT INTO records (id, dataset_id, excel_id, name, mobile, email, company, custom_fields, is_deleted)
      VALUES 
        ($1, $3, 'SEARCH-01', 'David Tech', '5551112222', 'david@tech.com', 'Engineering', '{"Level":"Senior"}'::jsonb, FALSE),
        ($2, $3, 'SEARCH-02', 'Eva Sales', '5553334444', 'eva@sales.com', 'Marketing', '{"Level":"Junior"}'::jsonb, FALSE)
    `, [id1, id2, testDatasetId]);

    // Test AND criteria: Name = 'David Tech' AND Company = 'Engineering'
    const andSearch = await searchRecords({
      criteria: [
        { field: 'name', operator: 'equals', value: 'David Tech' },
        { field: 'company', operator: 'equals', value: 'Engineering' }
      ],
      operator: 'AND'
    });
    const andList = andSearch.records || andSearch.data || [];
    assert.strictEqual(andList.length, 1);
    assert.strictEqual(andList[0].excel_id, 'SEARCH-01');

    // Test OR criteria: Excel ID = 'SEARCH-01' OR Excel ID = 'SEARCH-02'
    const orSearch = await searchRecords({
      criteria: [
        { field: 'excel_id', operator: 'equals', value: 'SEARCH-01' },
        { field: 'excel_id', operator: 'equals', value: 'SEARCH-02' }
      ],
      operator: 'OR'
    });
    const orList = orSearch.records || orSearch.data || [];
    assert.strictEqual(orList.length, 2);

    // Test custom field criteria
    const customSearch = await searchRecords({
      criteria: [
        { field: 'custom:Level', operator: 'equals', value: 'Senior' }
      ]
    });
    const customList = customSearch.records || customSearch.data || [];
    assert.strictEqual(customList.length, 1);
    assert.strictEqual(customList[0].excel_id, 'SEARCH-01');
  });

  await t.test('Feature 5: Custom column Excel and PDF exports', async () => {
    const testRecords = [
      { id: '1', excel_id: '00123', name: 'Frank Export', mobile: '09988776655', email: 'frank@export.com', company: 'Export Corp', custom_fields: { Note: 'VIP' }, created_at: new Date() }
    ];

    // Excel export with custom columns and ordering
    const excelBuf = await generateExcelExport(testRecords, {
      selectedColumns: ['excel_id', 'company', 'custom:Note'],
      reportTitle: 'Custom Selected Columns Report'
    });
    assert.ok(excelBuf instanceof Buffer);
    assert.ok(excelBuf.length > 500, 'Excel buffer should contain generated spreadsheet');

    // PDF export with custom columns
    const pdfBuf = await generatePdfExport(testRecords, {
      selectedColumns: ['excel_id', 'name', 'company'],
      reportTitle: 'Custom Selected PDF Report'
    });
    assert.ok(pdfBuf instanceof Buffer);
    assert.ok(pdfBuf.length > 500, 'PDF buffer should contain generated document');
  });

  await t.test('Feature 7: Error report generation for import job', async () => {
    // Generate import job with errors
    const testJobId = crypto.randomUUID();
    const sampleErrors = [
      { row: 4, excel_id: 'ERR-01', column: 'Mobile Number', category: 'INVALID_FORMAT', reason: 'Mobile number contains letters.', suggested_fix: 'Enter digits only.' }
    ];
    await query(`
      INSERT INTO import_jobs (id, user_id, filename, worksheet, dataset_id, mode, errors, status, stage, created_at)
      VALUES ($1, 1, 'errors_test.xlsx', 'Sheet1', $2, 'merge', $3, 'completed', 'completed', CURRENT_TIMESTAMP)
    `, [testJobId, testDatasetId, JSON.stringify(sampleErrors)]);

    const csvContent = await generateErrorReportCsv(testJobId);
    assert.ok(csvContent.includes('ERR-01'));
    assert.ok(csvContent.includes('INVALID_FORMAT'));
    assert.ok(csvContent.includes('Mobile number contains letters.'));
  });

  await t.test('Feature 9: Data quality and duplicate analysis report', async () => {
    const dq1 = crypto.randomUUID();
    const dq2 = crypto.randomUUID();

    // Insert duplicate phone across records
    await query(`
      INSERT INTO records (id, dataset_id, excel_id, name, mobile, email, company, is_deleted)
      VALUES 
        ($1, $3, 'DQ-01', 'Grace First', '9998887777', 'grace@duplicate.com', 'HQ', FALSE),
        ($2, $3, 'DQ-02', 'Grace Second', '9998887777', 'grace@duplicate.com', 'HQ', FALSE)
    `, [dq1, dq2, testDatasetId]);

    const audit = await runDataQualityAnalysis({ datasetId: testDatasetId });
    assert.ok(audit.totalAnalyzed >= 2);
    assert.ok(audit.categoryCounts.duplicatePhoneNumbers >= 1, 'Should detect shared phone numbers');
    assert.ok(audit.categoryCounts.duplicateEmails >= 1, 'Should detect shared emails');

    const csvReport = await generateDataQualityCsv({ datasetId: testDatasetId });
    assert.ok(csvReport.includes('DUPLICATE_PHONE'));
  });
});
