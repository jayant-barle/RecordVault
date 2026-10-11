# Windows 11 LAN Deployment & Administration Guide

## 1. Overview
The **Excel Search & Record Management Website** is designed to run locally on your Windows 11 host PC while serving authorized devices (laptops, tablets, mobile phones) connected to the same Wi-Fi or Local Area Network (LAN).

---

## 2. Accessing the Application

### Host PC (Development Computer)
- **Frontend / Unified Web UI**: [http://localhost:5000](http://localhost:5000) (Production) or [http://localhost:5173](http://localhost:5173) (Development)
- **Backend API**: [http://localhost:5000/api](http://localhost:5000/api)

### Other Devices on the Same Wi-Fi / LAN
Find your host PC's LAN IP address by running:
```powershell
npm run get-ip
```
*Current detected LAN IP:* `192.168.29.216`

From any phone, tablet, or PC connected to the same Wi-Fi network, navigate to:
```
http://192.168.29.216:5000
```
(or `http://192.168.29.216:5173` when running `npm run dev`)

---

## 3. Windows Firewall Configuration

By default, Windows Defender Firewall may block inbound connections from other devices on your Wi-Fi.

To allow LAN devices on your Private Network, open **PowerShell as Administrator** in the project directory and run:
```powershell
powershell -ExecutionPolicy Bypass -File .\lan-firewall-setup.ps1
```

Or manually execute the following commands in an elevated PowerShell:
```powershell
New-NetFirewallRule -DisplayName "Excel Management Web & API (Port 5000)" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow -Profile Private
New-NetFirewallRule -DisplayName "Excel Management Dev UI (Port 5173)" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow -Profile Private
```

> **Security Note:** Notice that only ports 5000 and 5173 are opened to your Private Network profile. Database ports (5432) remain strictly closed and inaccessible to ordinary LAN clients.

---

## 4. Starting and Stopping the Application

### Development Mode (with Live Reloading):
```powershell
npm run dev
```
or double-click `start.bat`.

### Production Server Mode:
```powershell
# 1. Build the production client
npm run build

# 2. Start the unified production server
npm start
```

### Stopping the Application:
Press `Ctrl + C` in the PowerShell terminal, then enter `Y` to confirm terminating the process.

---

## 5. Shared Permissions Model Notice
Every authenticated user on the LAN currently has full administrative permissions:
- Exact-match search & record viewing
- Multi-file Excel uploading & worksheet inspection
- Merge & Replace dataset operations
- Record editing and deletion (single and batch)
- Excel (.xlsx) and PDF export generation

*A warning banner is permanently displayed on the web dashboard to keep all LAN users aware of this shared management authority.*

---

## 6. Database Backup and Restore Procedures

The application supports both native external PostgreSQL (via `DATABASE_URL`) and zero-dependency embedded persistent PostgreSQL (`@electric-sql/pglite` stored on disk).

### Embedded Engine Backup:
All database records, datasets, audit logs, and search history are persistently stored on disk at:
```
server/data/pglite/
```
To back up:
```powershell
# Create a timestamped backup copy
Copy-Item -Recurse -Path "server\data\pglite" -Destination "server\data\pglite_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
```

To restore:
1. Stop the application server (`Ctrl + C`).
2. Replace `server\data\pglite` with your desired backup folder.
3. Restart the server.

### External PostgreSQL Backup (when using PostgreSQL service):
```powershell
# Backup
pg_dump -U postgres -d excel_records -F c -b -v -f "excel_records_backup.dump"

# Restore
pg_restore -U postgres -d excel_records -v "excel_records_backup.dump"
```

---

## 7. Security Best Practices for LAN Deployment
1. **Network Encryption (HTTP vs HTTPS):** Plain HTTP traffic over LAN is not encrypted across the Wi-Fi airwaves. For untrusted public Wi-Fi networks, connect only to private, WPA2/WPA3 password-protected Wi-Fi networks.
2. **Formula Injection Sanitization:** Every exported cell beginning with `=, +, -, @` is automatically escaped with a leading single quote (`'`) to protect spreadsheet users against DDE formula execution.
3. **Password Security:** All passwords are salt-hashed using `bcryptjs` with 10 rounds. Passwords are never returned in API payloads or logged in audit history.
