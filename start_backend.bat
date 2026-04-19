@echo off
setlocal
cd /d "%~dp0backend"

echo Starting Django on all interfaces, port 8000
echo Local:    http://127.0.0.1:8000
echo Same Wi-Fi: http://YOUR-PC-IP:8000  ^(YOUR-PC-IP from ipconfig^)
python manage.py runserver 0.0.0.0:8000
