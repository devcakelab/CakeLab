@echo off
setlocal
cd /d "%~dp0backend"

echo Starting Django backend on http://127.0.0.1:8000
python manage.py runserver
