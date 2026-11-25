@echo off
echo ========================================================
echo   Launching Smart Merchant Platform (3 Subsystems)
echo ========================================================

start "Smart Merchant - Express Backend (Port 5000)" cmd /k "cd backend && npm run dev"
timeout /t 2 /nobreak >nul

start "Smart Merchant - React Frontend (Port 3000)" cmd /k "cd frontend && npm run dev"
timeout /t 2 /nobreak >nul

if exist "ml-service\run.py" (
    start "Smart Merchant - ML Engine (Port 8000)" cmd /k "cd ml-service && python run.py"
)

echo.
echo All services launching in separate terminal windows:
echo - Frontend:  http://localhost:3000
echo - Backend:   http://localhost:5000/api
echo - ML Engine: http://localhost:8000
echo.
echo Production Cloud Deployments:
echo - Live Frontend: https://smart-merchant-appplication.vercel.app
echo - Live Backend:  https://smart-merchant-appplication.onrender.com/api
echo - Database:      Supabase PostgreSQL (aws-1-ap-northeast-2.pooler.supabase.com)
echo.
pause
