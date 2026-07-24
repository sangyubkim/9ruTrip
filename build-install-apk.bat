@echo off
chcp 65001 >nul
setlocal
title 9ruTrip APK 빌드 / 설치

set "PS1=%~dp0..\scripts\build-install-apk.ps1"
if not exist "%PS1%" (
  echo 스크립트 없음: %PS1%
  echo D:\01_Project\build-install-apk.bat 를 사용하세요.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -Project 9ruTrip %*
set ERR=%ERRORLEVEL%
echo.
pause
exit /b %ERR%
