@echo off
chcp 65001 >nul
title فتح منفذ 3000 في جدار الحماية - نظام المعسكر
echo.
echo ================================================
echo   فتح منفذ 3000 في جدار حماية ويندوز
echo   (لتشغيل هذا الملف: انقر يمين ثم "تشغيل كمسؤول")
echo ================================================
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [خطأ] يجب تشغيل هذا الملف كمسؤول.
    echo        انقر على الملف بالزر الأيمن ثم اختر "تشغيل كمسؤول".
    echo.
    pause
    exit /b 1
)

netsh advfirewall firewall add rule name="Camp Registration - Port 3000" dir=in action=allow protocol=TCP localport=3000

echo.
echo [تم] المنفذ 3000 أصبح مفتوحًا — الطلاب داخل نفس الشبكة
echo      يستطيعون الآن فتح صفحة التسجيل.
echo.
pause