@echo off
echo ========================================================
echo   Launching Smart Merchant Platform (3 Subsystems)
echo ========================================================

start "Smart Merchant - ML Engine (Port 8000)" cmd /k "cd ml-service && python run.py"
timeout /t 2 /nobreak >nul

start "Smart Merchant - Express Backend (Port 5000)" cmd /k "cd backend && npm start"
timeout /t 2 /nobreak >nul

start "Smart Merchant - React Frontend (Port 3000)" cmd /k "cd frontend && npm run dev"

echo.
echo All 3 services are launching in separate terminal windows:
echo - Frontend:  http://localhost:3000
echo - Backend:   http://localhost:5000/api
echo - ML Engine: http://localhost:8000
echo.
pause
