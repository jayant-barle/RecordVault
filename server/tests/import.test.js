import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { runMigrations } from '../src/db/migrations.js';
import { query } from '../src/db/index.js';
import { inspectWorkbook, extractWorksheetRecords } from '../src/services/excelParser.js';
import { executeImport } from '../src/services/importService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sampleFile = path.resolve(__dirname, '../../sample_data/sample_employees.xlsx');

process.env.NODE_ENV = 'test';

test('Excel Import Suite', async (t) => {
  await runMigrations();
  const buffer = fs.readFileSync(sampleFile);

  await t.test('inspectWorkbook should identify all worksheets and headers', () => {
    const info = inspectWorkbook(buffer, 'sample_employees.xlsx');
    assert.strictEqual(info.sheetNames.length, 2);
    assert.ok(info.sheetNames.includes('Staff Records'));
    assert.ok(info.sheetNames.includes('Contractors'));

    const staffSheet = info.sheets.find(s => s.name === 'Staff Records');
    assert.ok(staffSheet);
    assert.ok(staffSheet.headers.includes('Employee ID'));
    assert.ok(staffSheet.headers.includes('Full Name'));
    assert.ok(staffSheet.headers.includes('Mobile Number'));
    assert.ok(staffSheet.headers.includes('Designation')); // Custom field
    assert.strictEqual(staffSheet.suggestedMapping['Employee ID'], 'excel_id');
    assert.strictEqual(staffSheet.suggestedMapping['Mobile Number'], 'mobile');
  });

  await t.test('extractWorksheetRecords should preserve leading zeros and custom fields', () => {
    const records = extractWorksheetRecords(buffer, 'Staff Records', {
      'Employee ID': 'excel_id',
      'Full Name': 'name',
      'Mobile Number': 'mobile',
      'Email Address': 'email',
      'Department': 'company',
      'Designation': 'custom',
      'City': 'custom'
    });

    assert.ok(records.length >= 7);
    const first = records[0];
    assert.strictEqual(first.excel_id, '00101', 'Leading zero in ID must be preserved as string');
    assert.strictEqual(first.mobile, '09876543210', 'Leading zero in phone must be preserved');
    assert.strictEqual(first.custom_fields['City'], 'New York');
    assert.strictEqual(first.custom_fields['Designation'], 'Senior Architect');
  });

  await t.test('executeImport should detect duplicate ID within upload and skip it', async () => {
    const records = extractWorksheetRecords(buffer, 'Staff Records', {
      'Employee ID': 'excel_id',
      'Full Name': 'name',
      'Mobile Number': 'mobile',
      'Email Address': 'email',
      'Department': 'company'
    });

    const summary = await executeImport({
      records,
      filename: 'sample_employees.xlsx',
      worksheet: 'Staff Records',
      mode: 'replace',
      datasetId: 'test-dataset-staff',
      datasetName: 'Staff Test Dataset',
      userId: 1,
      username: 'admin'
    });

    assert.strictEqual(summary.mode, 'replace');
    assert.strictEqual(summary.inserted, 6, '6 unique staff records should be inserted');
    assert.strictEqual(summary.skipped, 1, '1 duplicate row (Charlie 00103) should be skipped');
    assert.ok(summary.errors.some(e => e.id === '00103' && e.reason.includes('Duplicate ID')));

    // Verify records in DB
    const dbRecords = await query("SELECT * FROM records WHERE dataset_id = 'test-dataset-staff'");
    assert.strictEqual(dbRecords.rows.length, 6);
    const alice = dbRecords.rows.find(r => r.excel_id === '00101');
    assert.ok(alice);
    assert.strictEqual(alice.mobile, '09876543210');
  });

  await t.test('executeImport in Merge mode should update matching and preserve untouched records', async () => {
    // Modify Alice and add a new employee
    const mergeBatch = [
      {
        excel_id: '00101',
        name: 'Alice Johnson Updated',
        mobile: '09876543210',
        email: 'alice.updated@corp.com',
        company: 'Executive Engineering',
        custom_fields: { Promotion: '2026' }
      },
      {
        excel_id: '00107',
        name: 'Grace Hopper',
        mobile: '01112223344',
        email: 'grace@corp.com',
        company: 'Computing',
        custom_fields: { Legend: 'Yes' }
      }
    ];

    const mergeSummary = await executeImport({
      records: mergeBatch,
      filename: 'sample_employees.xlsx',
      worksheet: 'Staff Records',
      mode: 'merge',
      datasetId: 'test-dataset-staff',
      datasetName: 'Staff Test Dataset',
      userId: 1,
      username: 'admin'
    });

    assert.strictEqual(mergeSummary.updated, 1, 'Alice 00101 should be updated');
    assert.strictEqual(mergeSummary.inserted, 1, 'Grace 00107 should be inserted');

    // Untouched records (Bob 00102, Charlie 00103, etc.) must still exist!
    const updatedBob = await query("SELECT * FROM records WHERE dataset_id = 'test-dataset-staff' AND excel_id = '00102'");
    assert.strictEqual(updatedBob.rows.length, 1, 'Bob 00102 must still be preserved');

    const updatedAlice = await query("SELECT * FROM records WHERE dataset_id = 'test-dataset-staff' AND excel_id = '00101'");
    assert.strictEqual(updatedAlice.rows[0].name, 'Alice Johnson Updated');
    assert.strictEqual(updatedAlice.rows[0].email, 'alice.updated@corp.com');
  });
});
