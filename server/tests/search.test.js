import test from 'node:test';
import assert from 'node:assert/strict';

import { runMigrations } from '../src/db/migrations.js';
import { executeImport } from '../src/services/importService.js';
import { searchRecords } from '../src/services/searchService.js';

process.env.NODE_ENV = 'test';

test('Exact-Match Search Suite', async (t) => {
  await runMigrations();

  // Seed sample records for test
  await executeImport({
    records: [
      {
        excel_id: '00901',
        name: 'Sarah Connor',
        mobile: '08001234567',
        email: 'sarah@resistance.org',
        company: 'Defense Network',
        custom_fields: { Rank: 'Commander', Clearance: 'TopSecret' }
      },
      {
        excel_id: '00902',
        name: 'John Connor',
        mobile: '08007654321',
        email: 'john@resistance.org',
        company: 'Operations',
        custom_fields: { Rank: 'General', Clearance: 'Ultra' }
      }
    ],
    filename: 'test_units.xlsx',
    worksheet: 'Sheet1',
    mode: 'replace',
    datasetId: 'test-dataset-search',
    datasetName: 'Search Test Dataset',
    userId: 1,
    username: 'admin'
  });

  await t.test('Exact match on ID with leading zero', async () => {
    const res = await searchRecords({
      queryText: '00901',
      searchField: 'excel_id',
      datasetId: 'test-dataset-search'
    });
    assert.strictEqual(res.records.length, 1);
    assert.strictEqual(res.records[0].name, 'Sarah Connor');
    assert.strictEqual(res.records[0].excel_id, '00901');
  });

  await t.test('Exact match on Mobile preserving leading zero', async () => {
    const res = await searchRecords({
      queryText: '08007654321',
      searchField: 'mobile',
      datasetId: 'test-dataset-search'
    });
    assert.strictEqual(res.records.length, 1);
    assert.strictEqual(res.records[0].name, 'John Connor');
  });

  await t.test('Exact match with accidental whitespace and differing case', async () => {
    const res = await searchRecords({
      queryText: '   sarah connor   ',
      searchField: 'name',
      datasetId: 'test-dataset-search'
    });
    assert.strictEqual(res.records.length, 1);
    assert.strictEqual(res.records[0].excel_id, '00901');
  });

  await t.test('Exact match on dynamic custom JSONB field', async () => {
    const res = await searchRecords({
      queryText: 'TopSecret',
      searchField: 'custom:Clearance',
      datasetId: 'test-dataset-search'
    });
    assert.strictEqual(res.records.length, 1);
    assert.strictEqual(res.records[0].name, 'Sarah Connor');
  });

  await t.test('Exact match search across all fields (field="all")', async () => {
    const res = await searchRecords({
      queryText: 'General',
      searchField: 'all',
      datasetId: 'test-dataset-search'
    });
    assert.strictEqual(res.records.length, 1);
    assert.strictEqual(res.records[0].name, 'John Connor');
  });

  await t.test('No match for partial or nonexistent value', async () => {
    const res = await searchRecords({
      queryText: 'Sarah', // Partial name should not match in strict exact match mode
      searchField: 'name',
      datasetId: 'test-dataset-search'
    });
    assert.strictEqual(res.records.length, 0, 'Partial search should return 0 results in exact match mode');
  });
});
