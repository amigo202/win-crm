@echo off
chcp 65001 >nul
title WIN CRM — Deploy to Netlify
color 0A
cd /d "%~dp0"

echo.
echo  ══════════════════════════════════════════
echo   WIN CRM — פרסום לנטליפי
echo  ══════════════════════════════════════════
echo.
echo  שלב 1: בונה את הפרויקט...
echo.

call npm run build

if errorlevel 1 (
  echo.
  echo  ✕ שגיאה בבנייה! בדוק שnpm install רץ קודם.
  pause
  exit /b 1
)

echo.
echo  ✓ הבנייה הסתיימה! נוצרה תיקיית dist\
echo.
echo  ══════════════════════════════════════════
echo   שלב 2: פתח את נטליפי בדפדפן
echo  ══════════════════════════════════════════
echo.
echo  1. הדפדפן ייפתח לאתר נטליפי שלך
echo  2. לחץ על "Deploys"
echo  3. גרור את תיקיית dist\ לתוך האזור הכחול
echo  4. המתן ~30 שניות — הסתיים!
echo.

start https://app.netlify.com/sites/frabjous-marzipan-d68ffc/deploys

echo  פותח את תיקיית dist\ בסייר הקבצים...
start "" "%~dp0dist"

echo.
pause
