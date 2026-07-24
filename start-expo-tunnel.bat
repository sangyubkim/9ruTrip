@echo off
chcp 65001 >nul
echo.
echo [9ruTrip] Expo tunnel 모드 (다른 Wi‑Fi / 방화벽 이슈 시)
echo 지도·로컬 API는 터널과 별개입니다. API는 앱 설정에서 PC LAN IP로 맞추세요.
echo.
call "%~dp0expo-mobile.bat" start -c --tunnel
pause
