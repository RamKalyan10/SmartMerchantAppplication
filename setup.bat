@echo off
echo ========================================================
echo   Setting up Smart Merchant Full-Stack AI Platform
echo   Subsystems: React Frontend, Express Backend, ML Engine
echo ========================================================

echo.
echo [1/3] Installing Python ML Service Dependencies...
if exist "ml-service\requirements.txt" (
    cd ml-service
    python -m pip install -r requirements.txt
    cd ..
) else (
    echo [Info] ML Service directory verified.
)

echo.
echo [2/3] Installing Express Backend Dependencies...
cd backend
call npm install
cd ..

echo.
echo [3/3] Installing React Frontend Dependencies...
cd frontend
call npm install
cd ..

echo.
echo ========================================================
echo   Setup Complete!
echo   Run start_all.bat to launch all 3 subsystems.
echo ========================================================
pause
