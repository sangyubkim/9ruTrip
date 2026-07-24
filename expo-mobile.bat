@echo off
REM Expo는 apps\mobile 에서만 실행 (루트에서 npx expo 금지)
setlocal EnableExtensions
chcp 65001 >nul

if exist "%ProgramFiles%\nodejs" set "PATH=%ProgramFiles%\nodejs;%PATH%"

cd /d "%~dp0apps\mobile"
if errorlevel 1 (
  echo [오류] apps\mobile 폴더를 찾을 수 없습니다.
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo [오류] Node.js 가 설치되어 있지 않습니다.
  exit /b 1
)

if not exist "node_modules\expo\package.json" (
  echo [안내] apps\mobile 의존성 설치 중...
  call npm install
  if errorlevel 1 exit /b 1
)

call npx expo %*
