@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\uwe-wizard.ps1" -Mode release -BundlePath "%~dp0release"
pause
