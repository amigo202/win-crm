@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo WIN CRM - Build + Push to GitHub
echo ==============================

if exist ".git\index.lock" del /f ".git\index.lock"

git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo Adding remote...
    git remote add origin https://github.com/amigo202/win-crm.git
)

echo Building locally (ensures correct Hebrew encoding)...
call npm run build
if errorlevel 1 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)
echo Build OK.

echo Staging files...
git add src/
git add public/
git add index.html
git add netlify.toml
git add .gitignore
git add dist/

echo Committing...
git commit -m "deploy: pre-built dist with correct Hebrew encoding"

echo Pushing to GitHub...
git push -u origin main

if errorlevel 1 (
    echo.
    echo ERROR: Push failed. Try GitHub Desktop instead.
    echo Open GitHub Desktop and click Push origin.
) else (
    echo.
    echo SUCCESS! Netlify will deploy in ~30 seconds.
    echo Open: https://frabjous-marzipan-d68ffc.netlify.app
    start https://app.netlify.com/sites/frabjous-marzipan-d68ffc/deploys
)

pause
