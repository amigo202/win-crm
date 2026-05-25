@echo off
chcp 65001 >nul
title WIN CRM — GitHub Setup
color 0B
cd /d "%~dp0"

echo.
echo  ══════════════════════════════════════════════════
echo   הגדרת Git + GitHub — פעם אחת, לתמיד!
echo  ══════════════════════════════════════════════════
echo.
echo  אחרי ההגדרה: כל שמירה בגיט = עדכון אוטומטי בנטליפי
echo.

:: Step 1: Init git
echo  [1/5] מאתחל git...
git init
git branch -M main

:: Step 2: Configure identity
echo  [2/5] מגדיר זהות...
git config user.email "amigosy@gmail.com"
git config user.name "Amitay Cohen"

:: Step 3: Create .gitignore if missing
if not exist ".gitignore" (
  echo  [3/5] יוצר .gitignore...
  (
    echo node_modules/
    echo dist/
    echo .env
    echo .env.local
    echo *.log
  ) > .gitignore
) else (
  echo  [3/5] .gitignore קיים — מדלג
)

:: Step 4: First commit
echo  [4/5] מבצע commit ראשון...
git add .
git commit -m "feat: WIN CRM v2 — Focus Strip, transitions, skeleton loaders"

echo.
echo  ══════════════════════════════════════════════════
echo   [5/5] עכשיו צור ריפו ב-GitHub:
echo  ══════════════════════════════════════════════════
echo.
echo  1. הדפדפן ייפתח ל-GitHub
echo  2. לחץ "New repository"
echo  3. שם: win-crm
echo  4. Private, ללא README
echo  5. לחץ "Create repository"
echo  6. העתק את ה-URL (https://github.com/..../win-crm.git)
echo  7. חזור לכאן והכנס את ה-URL:
echo.

start https://github.com/new

set /p REPO_URL="  הדבק את ה-GitHub URL כאן: "

if "%REPO_URL%"=="" (
  echo  ✕ לא הוזן URL. הרץ שוב לאחר יצירת הריפו.
  pause
  exit /b 1
)

echo.
echo  [6/5] מחבר ל-GitHub ודוחף...
git remote add origin %REPO_URL%
git push -u origin main

if errorlevel 1 (
  echo.
  echo  ✕ שגיאה בדחיפה. ודא שהריפו נוצר ושה-URL נכון.
  pause
  exit /b 1
)

echo.
echo  ══════════════════════════════════════════════════
echo   ✓ הקוד עלה ל-GitHub!
echo  ══════════════════════════════════════════════════
echo.
echo  עכשיו חבר נטליפי ל-GitHub:
echo  1. כנס ל-Netlify Dashboard
echo  2. Site settings ^> Build ^& deploy ^> Link to Git
echo  3. בחר GitHub ^> win-crm
echo  4. Build command: npm run build
echo  5. Publish directory: dist
echo  6. לחץ Deploy!
echo.
echo  מעכשיו: כל git push = עדכון אוטומטי בנטליפי ✓
echo.

start https://app.netlify.com/sites/frabjous-marzipan-d68ffc/settings/deploys

pause
