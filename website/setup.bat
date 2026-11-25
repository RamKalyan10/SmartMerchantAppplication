@echo off
echo ========================================================
echo   Setting up Smart Merchant Full-Stack AI Platform
echo ========================================================

echo.
echo [1/3] Installing Python ML Service Dependencies...
cd ml-service
python -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [Warning] Python pip install encountered an issue. Ensure Python 3.9+ and pip are on PATH.
)
cd ..

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
echo   Run start_all.bat to launch all 3 services.
echo ========================================================
pause
