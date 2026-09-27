@echo off
echo ========================================================
echo Grafana Configuration Fix for API Cortex
echo ========================================================
echo.

:: Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Success: Administrative permissions confirmed.
) else (
    echo Requesting Administrative permissions...
    powershell -Command "Start-Process '%~dpnx0' -Verb RunAs"
    exit /b
)

echo.
echo Copying custom.ini to Grafana config folder...
copy "C:\Users\mypc\Desktop\API-Cortex\custom.ini" "C:\Program Files\GrafanaLabs\grafana\conf\custom.ini" /Y

echo.
echo Restarting Grafana service...
net stop Grafana
net start Grafana

echo.
echo ========================================================
echo Fix Complete! You can now close this window and refresh API Cortex.
echo ========================================================
pause
