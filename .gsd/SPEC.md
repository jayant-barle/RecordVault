# Project Specification: Excel Search & Record Management Website

Status: FINALIZED
Date: 2026-10-11
Author: Senior Full-Stack Engineer

## 1. Executive Summary
A secure, responsive, LAN-accessible web application for importing, searching, managing, auditing, and exporting business records from Microsoft Excel workbooks (.xlsx and .xls).

## 2. Core Architecture
- **Backend**: Node.js + Express (ESM), parameterized SQL queries, JWT/Session authentication, Multer file upload, Excel processing via `xlsx` / `exceljs`, PDF generation via `pdfkit`, Helmet & Rate Limiting.
- **Frontend**: React 19 + Vite, Vanilla CSS with modern design tokens (Inter typography, dark/light themes, sleek glassmorphism, responsive tables and cards).
- **Database**: PostgreSQL (standard `pg` pool connecting to local or remote PostgreSQL with parameterized queries and migrations; dual-mode embedded PostgreSQL compatibility layer with disk persistence when standalone PostgreSQL server is absent).
- **Deployment**: Windows 11 host binding to `0.0.0.0` for LAN access across authorized devices.

## 3. Key Modules
1. **Authentication & Authorization**: Secure username/password login, bcrypt password hashing, token validation middleware, shared administration role model with explicit warning banners.
2. **Excel Import Engine**: Multi-file upload, multi-worksheet support, preview before commit, custom field mapping, leading zero preservation (`00123`, `0987...`), duplicate detection within upload and against existing records, Merge and Replace modes, transactional operations, detailed audit logging.
3. **Exact-Match Search Engine**: Fast exact-match queries on Name, Phone, Email, ID, Company/Department, and dynamic custom columns; leading zero preserved; whitespace trimmed; case normalization for text; server-side pagination and sorting.
4. **Record Management**: Detailed view modal (all standard + custom columns), edit with validation, delete with confirmation, multi-record selection.
5. **Excel & PDF Export**: Server-side authorized export of selected or filtered records. Escapes formula injection (`=`, `+`, `-`, `@`), preserves phone/ID leading zeros as text, generates structured PDF reports.
6. **Audit & Search History**: Persistent logging of user searches and management actions (imports, creates, updates, deletes, exports).
7. **LAN Configuration**: Network IP discovery, host binding, private network firewall rules, database backup/restore guides.
