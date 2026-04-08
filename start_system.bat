@echo off
setlocal
cd /d "%~dp0"

echo Launching CakeLab system...
start "CakeLab Backend" cmd /k ""%~dp0start_backend.bat""
start "CakeLab Frontend" cmd /k ""%~dp0start_frontend.bat""
timeout /t 4 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo Backend:  http://127.0.0.1:8000
echo Frontend: http://localhost:5173
echo.
echo You can close this window. App runs in the two new terminals.
