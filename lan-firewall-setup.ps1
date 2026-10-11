# Windows Firewall Inbound Rules for Excel Record Management System LAN Access
# Run this PowerShell script as Administrator to allow LAN devices to access the application

Write-Host "Configuring Windows Defender Firewall for LAN Access..." -ForegroundColor Cyan

# 1. Allow port 5000 (Backend API & Static Web Server)
New-NetFirewallRule -DisplayName "Excel Record Management API (Port 5000)" `
    -Direction Inbound `
    -LocalPort 5000 `
    -Protocol TCP `
    -Action Allow `
    -Profile Private `
    -Description "Allows authorized devices on the same Wi-Fi/LAN to access the Excel Management API"

# 2. Allow port 5173 (Vite Frontend Dev Server)
New-NetFirewallRule -DisplayName "Excel Record Management Frontend (Port 5173)" `
    -Direction Inbound `
    -LocalPort 5173 `
    -Protocol TCP `
    -Action Allow `
    -Profile Private `
    -Description "Allows authorized devices on the same Wi-Fi/LAN to access the React Web UI"

Write-Host "✅ Windows Firewall Inbound Rules successfully created for Private Network on ports 5000 and 5173!" -ForegroundColor Green
Write-Host "Note: PostgreSQL port 5432 is kept closed to LAN clients for security." -ForegroundColor Yellow
