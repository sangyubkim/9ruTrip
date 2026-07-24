@echo off
setlocal EnableExtensions
chcp 65001 >nul

cd /d "%~dp0.."
if errorlevel 1 (
  echo [오류] 프로젝트 루트를 찾을 수 없습니다.
  exit /b 1
)

if not exist "apps\api\.env" (
  echo [안내] apps\api\.env 가 없습니다. .env.example 을 복사해 키를 넣으세요.
)

where node >nul 2>&1
if errorlevel 1 (
  echo [오류] Node.js 가 설치되어 있지 않습니다.
  exit /b 1
)

echo [9ruTrip API] http://0.0.0.0:3011  (폰에서는 PC LAN IP:3011)
echo LAN IP 확인: ipconfig  → 무선 LAN IPv4
echo.
node apps\api\server.mjs
pause
