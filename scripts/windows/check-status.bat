@echo off
REM Quick status check — shows Last Run Time, Last Result, and Next Run
REM for each DIBS task.

echo.
echo === DIBS Scheduled Tasks Status ===
echo.

schtasks /query /tn "DIBS - Abe Bids Sync" /v /fo LIST 2>nul | findstr /C:"TaskName" /C:"Last Run" /C:"Last Result" /C:"Next Run"
echo.
schtasks /query /tn "DIBS - LamLinks Sol Import AM" /v /fo LIST 2>nul | findstr /C:"TaskName" /C:"Last Run" /C:"Last Result" /C:"Next Run"
echo.
schtasks /query /tn "DIBS - LamLinks Sol Import PM" /v /fo LIST 2>nul | findstr /C:"TaskName" /C:"Last Run" /C:"Last Result" /C:"Next Run"
echo.
schtasks /query /tn "DIBS - Awards Import" /v /fo LIST 2>nul | findstr /C:"TaskName" /C:"Last Run" /C:"Last Result" /C:"Next Run"
echo.
schtasks /query /tn "DIBS - Shipping Sync" /v /fo LIST 2>nul | findstr /C:"TaskName" /C:"Last Run" /C:"Last Result" /C:"Next Run"
echo.
schtasks /query /tn "DIBS - Daily Briefing" /v /fo LIST 2>nul | findstr /C:"TaskName" /C:"Last Run" /C:"Last Result" /C:"Next Run"

echo.
echo Log files in C:\tmp\dibs-logs\:
if exist C:\tmp\dibs-logs dir /b /o-d C:\tmp\dibs-logs
echo.
echo "Last Result" 0 = success. Any other code = failure.
