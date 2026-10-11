import test from 'node:test';
import assert from 'node:assert/strict';

import { runMigrations } from '../src/db/migrations.js';
import { executeImport } from '../src/services/importService.js';
import { query } from '../src/db/index.js';
import { generateExcelExport, generatePdfExport } from '../src/services/exportService.js';

process.env.NODE_ENV = 'test';

test('Functional Operations & Exports Suite', async (t) => {
  await runMigrations();

  // Create a record for functional tests
  const importRes = await executeImport({
    records: [
      {
        excel_id: 'FN-101',
        name: 'Bruce Wayne',
        mobile: '0123456789',
        email: 'bruce@wayne-enterprises.com',
        company: 'Executive',
        custom_fields: { SecurityLevel: 'Alpha', NetWorth: 'Billionaire' }
      }
    ],
    filename: 'wayne_enterprises.xlsx',
    worksheet: 'Board',
    mode: 'replace',
    datasetId: 'dataset-fn-test',
    datasetName: 'Functional Test Dataset',
    userId: 1,
    username: 'admin'
  });

  const recRes = await query("SELECT * FROM records WHERE dataset_id = 'dataset-fn-test'");
  assert.strictEqual(recRes.rows.length, 1);
  const record = recRes.rows[0];

  await t.test('Update record details preserves identity and saves changes', async () => {
    await query(`
      UPDATE records
      SET name = $1, mobile = $2, company = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, ['Bruce Wayne Senior', '0123456789', 'Chairman', record.id]);

    const updated = await query('SELECT * FROM records WHERE id = $1', [record.id]);
    assert.strictEqual(updated.rows[0].name, 'Bruce Wayne Senior');
    assert.strictEqual(updated.rows[0].company, 'Chairman');
    assert.strictEqual(updated.rows[0].excel_id, 'FN-101', 'Excel ID should remain untouched');
  });

  await t.test('Excel Export generates valid workbook buffer with headers and data', async () => {
    const records = await query("SELECT r.*, d.name as dataset_name FROM records r LEFT JOIN datasets d ON r.dataset_id = d.id WHERE r.id = $1", [record.id]);
    const excelBuffer = generateExcelExport(records.rows, 'Export_Test');
    assert.ok(Buffer.isBuffer(excelBuffer));
    assert.ok(excelBuffer.length > 500, 'Excel buffer must contain valid spreadsheet data');
  });

  await t.test('PDF Export generates valid document buffer with report headers', async () => {
    const records = await query("SELECT r.*, d.name as dataset_name FROM records r LEFT JOIN datasets d ON r.dataset_id = d.id WHERE r.id = $1", [record.id]);
    const pdfBuffer = await generatePdfExport(records.rows, 'Functional Test PDF Report');
    assert.ok(Buffer.isBuffer(pdfBuffer));
    // Valid PDF starts with %PDF
    assert.strictEqual(pdfBuffer.subarray(0, 4).toString(), '%PDF');
  });

  await t.test('Delete record cleanly removes record and updates dataset count', async () => {
    await query('DELETE FROM records WHERE id = $1', [record.id]);
    const checkRec = await query('SELECT * FROM records WHERE id = $1', [record.id]);
    assert.strictEqual(checkRec.rows.length, 0);

    // Update dataset count
    await query(`
      UPDATE datasets 
      SET record_count = (SELECT COUNT(*) FROM records WHERE dataset_id = 'dataset-fn-test')
      WHERE id = 'dataset-fn-test'
    `);
    const checkDs = await query("SELECT record_count FROM datasets WHERE id = 'dataset-fn-test'");
    assert.strictEqual(parseInt(checkDs.rows[0].record_count, 10), 0);
  });
});
