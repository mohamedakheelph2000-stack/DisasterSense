@echo off
setlocal
echo ============================================================
echo          DisasterSense - Vercel Deployment Helper          
echo ============================================================

cd /d "%~dp0..\frontend"

echo.
echo [1/2] Checking Vercel Authentication...
call npx --yes vercel whoami
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Please log in to Vercel via browser:
    call npx --yes vercel login
    if %ERRORLEVEL% NEQ 0 (
        echo Vercel login failed. Aborting.
        exit /b 1
    )
)

echo.
echo [2/2] Deploying frontend to Vercel...
call npx --yes vercel --prod

echo.
echo ============================================================
echo   Deployment completed!
echo ============================================================
pause
