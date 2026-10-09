@echo off
chcp 65001 >nul
title نظام المعسكر - تشغيل الرابط العام
echo ================================================
echo   تشغيل نظام المعسكر مع رابط عام من الإنترنت
echo ================================================
echo.
echo [1/2] تشغيل الخادم المحلي...
start "MSALE Server" cmd /c "cd /d %~dp0 && npm start"
timeout /t 4 /nobreak >nul
echo [2/2] تشغيل النفق العام - انتظر حتى يظهر الروابط...
"%TEMP%\cloudflared.exe" tunnel --url http://localhost:3000 --no-autoupdate
pause