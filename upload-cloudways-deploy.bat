@echo off
setlocal EnableExtensions
cd /d "%~dp0"
if errorlevel 1 (
  echo [ERROR] Cannot cd to repo root.
  exit /b 1
)

if not exist "scripts\upload-cloudways-deploy.ps1" (
  echo [ERROR] Missing scripts\upload-cloudways-deploy.ps1
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\upload-cloudways-deploy.ps1" %*
set "EC=%ERRORLEVEL%"
if not "%EC%"=="0" (
  echo [ERROR] upload-cloudways-deploy.ps1 failed with exit %EC%
  exit /b %EC%
)
exit /b 0
