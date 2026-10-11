# Project Roadmap: Excel Search & Record Management Website

## Wave 1: Foundation & Backend Core
- [x] Task 1.1: Project initialization (root package.json, server, client scaffolding)
- [x] Task 1.2: Database schema, migrations, and PostgreSQL dual-mode connection engine (pg + persistent fallback)
- [x] Task 1.3: Authentication & security middleware (bcrypt, JWT/session, rate limit, CORS, Helmet)
- [x] Task 1.4: Sample Excel generation script for realistic test fixtures (leading zeros, duplicate records, custom columns)

## Wave 2: Excel Import & Management Engine
- [x] Task 2.1: Multi-file & multi-worksheet parser with column mapping & preview
- [x] Task 2.2: Transactional importer with Replace and Merge modes, duplicate detection, and leading zero preservation
- [x] Task 2.3: Record CRUD API (view, edit, delete with validation)
- [x] Task 2.4: Search API (exact match on standard + custom JSONB columns, pagination, sorting)
- [x] Task 2.5: Export API (Excel with formula neutralization + PDF generator)
- [x] Task 2.6: Search history & Audit logging API

## Wave 3: Frontend Web Application
- [x] Task 3.1: React + Vite setup with modern CSS design system, responsive layout, toast notifications
- [x] Task 3.2: Login view & shared permissions warning banner
- [x] Task 3.3: Main search dashboard with exact-match field selector, filters, sorting, and pagination
- [x] Task 3.4: Record table with multi-select, full details view modal, edit modal, and delete confirmation
- [x] Task 3.5: Multi-file Excel upload, worksheet preview, column mapper, mode selector (Replace vs Merge), and import summary
- [x] Task 3.6: Excel & PDF export controls (selected vs filtered)
- [x] Task 3.7: Search history & audit log viewer

## Wave 4: Testing, LAN Configuration & Verification
- [x] Task 4.1: Automated test suite (Import tests, Search tests, Security tests, Functional tests)
- [x] Task 4.2: LAN accessibility binding (0.0.0.0), IP display utility, and Firewall guide
- [x] Task 4.3: Build verification and final end-to-end report

## Wave 5: Advanced Excel Search & Record Management (Features 1-9)
- [x] Task 5.1: Automatic Database Backup and Restore Engine (scheduled cron, manual snapshots, custom json/tar format, pre-restore safety backups, validation)
- [x] Task 5.2: Undo Edits & Soft Deletion Recovery (record_versions diff tracking, transaction rollback, Recycle Bin recovery with collision protection)
- [x] Task 5.3: Import History & Journal Rollback (import_journal tracking, atomic rollback preserving subsequent edits)
- [x] Task 5.4: Advanced Multi-Field Search (AND/OR logic, date ranges, worksheet filters, empty/non-empty condition builder)
- [x] Task 5.5: Custom Columns for Excel & PDF Exports (column picker, reordering, formula injection defense, leading zero preservation)
- [x] Task 5.6: Dataset and Source Management (source overview, scoped queries, cross-dataset collision audit, safe deletion confirmation)
- [x] Task 5.7: Import Progress & Downloadable Error Reports (stage tracking, row counters, downloadable CSV error reports)
- [x] Task 5.8: LAN Connection & Database Telemetry (real-time ping, uptime, IP instructions, Windows firewall setup)
- [x] Task 5.9: Duplicate Detection & Data Quality Suite (duplicate IDs, duplicate phones/emails, format anomalies, CSV data-quality report)

