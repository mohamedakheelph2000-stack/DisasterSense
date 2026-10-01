@echo off
title DisasterSense Live Tunnel Launcher
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_shareable_tunnel.ps1"
pause
