@echo off
chcp 65001 > nul
echo.
echo ========================================
echo    WIN CRM - Deploy to Netlify
echo ========================================
echo.

cd /d "%~dp0"
echo [1/4] Building project...
echo.

REM Remove old dist files that might be locked
if exist dist\assets rmdir /s /q dist\assets 2>nul
if exist dist\index.html del /f /q dist\index.html 2>nul

REM Run the build
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Build failed!
    pause
    exit /b 1
)

echo.
echo [2/4] Build successful!
echo.
echo [3/4] Adding files to git...
git add -A

echo.
echo [4/4] Committing and pushing to GitHub...
git commit -m "feat: add Tax Radar + forgot password feature"
git push origin main

if %errorlevel% neq 0 (
    echo.
    echo Push failed - you may need to enter your GitHub credentials.
    echo Try running: git push origin main
    pause
    exit /b 1
)

echo.
echo ========================================
echo SUCCESS! Netlify will deploy in ~30 sec
echo Site: https://frabjous-marzipan-d68ffc.netlify.app
echo ========================================
echo.
pause
