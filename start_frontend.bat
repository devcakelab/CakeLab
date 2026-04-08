@echo off
setlocal
cd /d "%~dp0frontend"

if not exist "node_modules" (
  echo Frontend dependencies not found. Running npm install...
  npm.cmd install
)

echo Starting Vite frontend on http://localhost:5173
npm.cmd run dev
