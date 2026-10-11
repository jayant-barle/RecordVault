@echo off
TITLE Excel Record Management System - Windows LAN Runner
COLOR 0A

echo =======================================================================
echo   EXCEL SEARCH ^& RECORD MANAGEMENT SYSTEM (WINDOWS 11 LAN)
echo =======================================================================
echo.

:: Detect LAN IP
node server/src/utils/networkIp.js

echo Starting Application Dev Servers...
echo Press Ctrl+C at any time to stop.
echo.

npm run dev
