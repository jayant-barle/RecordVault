# Project State: Excel Search & Record Management Website

## Current Position
- **Phase**: Wave 4 Completed (Testing, LAN Configuration & Verification)
- **Status**: COMPLETE & VERIFIED
- **All 4 Waves**: Successfully implemented, tested, and passing all 21 test assertions.

## Test Summary
- **Test Runner**: Node.js test runner (`node:test`)
- **Total Assertions**: 21
- **Passed**: 21
- **Failed**: 0
- **Suites**:
  - `import.test.js`: Validates multi-sheet inspection, leading-zero preservation, duplicate row detection, Merge vs Replace transactional behavior.
  - `search.test.js`: Validates exact-match queries on ID (`00901`), Phone (`08007654321`), Name (with whitespace/case normalization), dynamic JSONB columns (`Clearance: TopSecret`), and rejects partial matches.
  - `security.test.js`: Validates formula injection neutralization (`=`, `+`, `-`, `@`), JWT authorization rejection for missing/invalid tokens, and SQL injection safety via query parameterization.
  - `functional.test.js`: Validates record editing, Excel (.xlsx) export buffer generation, PDF report buffer generation, and record deletion.

## LAN Deployment Information
- **Host LAN IP**: `192.168.29.216`
- **Backend API Binding**: `0.0.0.0:5000`
- **Frontend Web UI**: `http://localhost:5000` (Production) / `http://localhost:5173` (Dev)
- **Firewall Config**: `lan-firewall-setup.ps1`
- **Runner**: `start.bat` / `npm run dev`
