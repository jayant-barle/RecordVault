# Excel Search & Record Management Website

A secure, high-performance, LAN-accessible web application for importing, managing, searching, auditing, and exporting Microsoft Excel business records (`.xlsx` and `.xls`).

---

## 🌟 Key Features

1. **Excel Multi-File & Multi-Worksheet Import**:
   - Supports uploading multiple `.xlsx` and `.xls` files simultaneously.
   - Interactive worksheet picker with live preview of spreadsheet rows.
   - Smart header mapping to standard fields (`ID`, `Name`, `Mobile`, `Email`, `Company/Department`).
   - Retains all extra/custom columns seamlessly in PostgreSQL JSONB.
   - Choice between **Merge Mode** (updates matches & preserves untouched rows) and **Replace Mode** (safely replaces target dataset without deleting other collections).
   - Duplicate ID detection within the upload file with explicit skipped row reporting.
   - Preserves leading zeroes in IDs (e.g., `00101`) and mobile numbers (e.g., `09876543210`) as formatted strings.
   - Transactional execution with automatic rollback on error.

2. **High-Speed Exact-Match Search**:
   - Searches across Name, Mobile number, Email, Excel ID, Company, or dynamic Custom JSONB columns.
   - Strict exact-match semantics (whitespace-trimmed, case-insensitive text matching).
   - Server-side pagination, sorting, and dataset filtering.
   - SQL-injection safe with 100% parameterized queries.

3. **Complete Record Lifecycle Management**:
   - View complete record details (all standard fields + dynamic custom columns in a clean modal).
   - In-place record editing with backend validation and protected identity fields.
   - Single-record and batch-record deletion with confirmation modal.
   - Dataset source deletion with cascade cleanup.

4. **Spreadsheet & PDF Export**:
   - Server-side authorized export of selected records or all filtered query results.
   - **Excel (.xlsx)**: Formatted text columns preserving leading zeros and neutralized spreadsheet formula injection (`=`, `+`, `-`, `@`).
   - **PDF (.pdf)**: Clean report layout with timestamp, metadata header, pagination, and landscape table view.

5. **Security & Shared Administration**:
   - JWT authentication with secure password hashing (`bcryptjs`).
   - Shared administrative permission model with persistent dashboard warning banner.
   - Rate limiting on authentication (`express-rate-limit`) and security headers (`helmet`).
   - Audit trail tracking all import, edit, delete, and export actions.
   - Privacy-masked search query history.

6. **Windows 11 LAN Deployment**:
   - Binds to `0.0.0.0` for access across phones, tablets, and other PCs on the same Wi-Fi.
   - Real-time LAN IP auto-detection utility.
   - Pre-configured Windows Firewall scripts.

---

## 🚀 Quick Start on Windows 11

### Prerequisites
- **Node.js**: v18+ (tested on Node.js v24.19.0)
- **Database**: Works out of the box with embedded persistent PostgreSQL (`@electric-sql/pglite`), or connect to live PostgreSQL via `DATABASE_URL`.

### 1. Installation
```powershell
# Install server and client dependencies
npm run install:all
```

### 2. Generate Sample Test Fixtures
```powershell
npm run generate-samples
```
Creates realistic test Excel files in `samples/` (`sample_business_records.xlsx`, `sample_with_duplicates.xlsx`, `sample_security_payloads.xlsx`).

### 3. Run Development Servers
```powershell
npm run dev
```
or double-click `start.bat`.

### 4. Build & Run Production Server
```powershell
npm run build
npm start
```

---

## 🔐 Default Login Credentials

| Username | Password | Role |
| :--- | :--- | :--- |
| `admin` | `admin123` | Administrator |
| `manager` | `manager123` | Manager |

---

## 📡 Accessing Across Your Wi-Fi / LAN

1. View your host PC's Wi-Fi IP address:
   ```powershell
   npm run get-ip
   ```
2. Open Windows Firewall for LAN ports:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\lan-firewall-setup.ps1
   ```
3. On another device on the same Wi-Fi network, open a browser to:
   ```
   http://<YOUR_LAN_IP>:5000
   ```

---

## 🧪 Automated Test Suite

Run the comprehensive test suite (21 automated assertions covering Import, Search, Security, and Functional operations):
```powershell
npm test
```
All tests run with 100% pass rate.
