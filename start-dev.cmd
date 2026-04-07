@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%backend"
set "FRONTEND_DIR=%ROOT_DIR%frontend-react"

if not exist "%BACKEND_DIR%" (
  echo Backend directory not found: "%BACKEND_DIR%"
  exit /b 1
)

if not exist "%FRONTEND_DIR%" (
  echo Frontend directory not found: "%FRONTEND_DIR%"
  exit /b 1
)

echo Starting backend on http://localhost:5000 ...
start "Load Balancer Backend" cmd /k "cd /d "%BACKEND_DIR%" && node server.js"

echo Starting frontend on http://localhost:5173 ...
start "Load Balancer Frontend" cmd /k "cd /d "%FRONTEND_DIR%" && npm run dev"

echo Both services were started in separate Command Prompt windows.
