import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeCellValue } from '../src/utils/formulaSanitizer.js';
import { generateToken, requireAuth } from '../src/middleware/auth.js';
import { searchRecords } from '../src/services/searchService.js';
import { runMigrations } from '../src/db/migrations.js';

process.env.NODE_ENV = 'test';

test('Security & Validation Suite', async (t) => {
  await runMigrations();

  await t.test('Spreadsheet Formula Injection Neutralization', () => {
    // Dangerous DDE / CSV command injection payloads
    assert.strictEqual(sanitizeCellValue('=cmd|/C calc.exe!A0'), "'=cmd|/C calc.exe!A0");
    assert.strictEqual(sanitizeCellValue('+1+1'), "'+1+1");
    assert.strictEqual(sanitizeCellValue('-100'), "'-100");
    assert.strictEqual(sanitizeCellValue('@SUM(A1:A10)'), "'@SUM(A1:A10)");
    assert.strictEqual(sanitizeCellValue('\tmalicious'), "'\tmalicious");

    // Safe regular values should not be altered
    assert.strictEqual(sanitizeCellValue('John Doe'), 'John Doe');
    assert.strictEqual(sanitizeCellValue('0987654321'), '0987654321');
    assert.strictEqual(sanitizeCellValue('alice@corp.com'), 'alice@corp.com');
  });

  await t.test('JWT Middleware rejects missing and invalid token', () => {
    let statusSent = null;
    let jsonSent = null;

    const mockRes = {
      status(code) {
        statusSent = code;
        return this;
      },
      json(payload) {
        jsonSent = payload;
        return this;
      }
    };

    // 1. Missing token
    const reqMissing = { headers: {} };
    requireAuth(reqMissing, mockRes, () => {});
    assert.strictEqual(statusSent, 401);
    assert.strictEqual(jsonSent.success, false);

    // 2. Invalid token
    statusSent = null;
    const reqInvalid = { headers: { authorization: 'Bearer invalid.token.value' } };
    requireAuth(reqInvalid, mockRes, () => {});
    assert.strictEqual(statusSent, 401);

    // 3. Valid token
    let nextCalled = false;
    const validToken = generateToken({ id: 1, username: 'admin', role: 'admin' });
    const reqValid = { headers: { authorization: `Bearer ${validToken}` } };
    requireAuth(reqValid, mockRes, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
    assert.strictEqual(reqValid.user.username, 'admin');
  });

  await t.test('Search service handles SQL injection attempts safely via parameterization', async () => {
    const maliciousInput = "' OR 1=1; DROP TABLE records; --";
    const res = await searchRecords({
      queryText: maliciousInput,
      searchField: 'all'
    });
    // Should safely execute as an exact literal match and return 0 records without throwing or dropping anything
    assert.strictEqual(res.records.length, 0);
  });
});
