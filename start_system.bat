@echo off
setlocal
cd /d "%~dp0"

echo Launching CakeLab - host PC, Django 0.0.0.0:8000, Vite for LAN...
start "CakeLab Backend" cmd /k ""%~dp0start_backend.bat""
start "CakeLab Frontend" cmd /k ""%~dp0start_frontend.bat""
timeout /t 4 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo This PC:  http://localhost:5173  ^(browser may open automatically^)
echo API:      http://127.0.0.1:8000
echo.
echo Other PCs / tablets / phones on same Wi-Fi:
echo   Open http://YOUR-PC-IP:5173  ^(YOUR-PC-IP from ipconfig; Vite window shows Network URL^)
echo.
echo You can close this window. Servers keep running in the two new terminals.
