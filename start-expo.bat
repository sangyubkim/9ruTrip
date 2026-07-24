@echo off
chcp 65001 >nul
echo.
echo [9ruTrip] Expo는 apps\mobile 에서만 실행합니다.
echo 폰: Expo Go(SDK 55) 설치 후 QR 스캔 · PC·폰 같은 Wi‑Fi
echo API: 별도 터미널에서 scripts\start-api.bat (포트 3011)
echo.
call "%~dp0expo-mobile.bat" start -c
pause
