@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ===================================================
echo   [KuaiBlog] Refreshing _sidebar.md and feed.xml...
echo ===================================================
echo.

node build_sidebar.js
node build_feed.js

echo.
echo ===================================================
echo   Done! Press any key to close this window...
echo ===================================================
pause >nul
