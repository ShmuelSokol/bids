@echo off
REM DIBS — register all Windows scheduled tasks.
REM
REM These tasks handle the four LamLinks syncs that can't run on Railway
REM because LamLinks SQL Server uses Windows Authentication (trusted
REM connection from a domain-joined box only).
REM
REM Run this file ONCE on the designated Windows box:
REM   1. Open an Administrator cmd (right-click > Run as admin)
REM   2. cd C:\tmp\dibs-init\dibs\scripts\windows
REM   3. install-tasks.bat
REM
REM All tasks run as the currently logged-in user (so Windows Auth works).
REM Check status:  schtasks /query /tn "DIBS*" /v /fo LIST
REM View logs:     type C:\tmp\dibs-logs\<script-name>.log
REM Uninstall:     uninstall-tasks.bat

setlocal

set DISPATCHER=C:\tmp\dibs-init\dibs\scripts\windows\run-dibs-task.bat

if not exist "%DISPATCHER%" (
    echo ERROR: %DISPATCHER% not found. Did you clone the repo to C:\tmp\dibs-init\dibs?
    exit /b 1
)

REM -----------------------------------------------------------------------
REM One-time native-package install. These can NEVER live in package.json
REM (they'd crash the Railway Linux build), so we install them with
REM --no-save here. Idempotent: if they're already in node_modules npm
REM will be a no-op.
REM -----------------------------------------------------------------------
echo.
echo Ensuring native packages installed (mssql, msnodesqlv8)...
pushd C:\tmp\dibs-init\dibs
call npm install --no-save mssql msnodesqlv8
if errorlevel 1 (
    echo WARNING: native package install failed. Tasks will still register
    echo          but LamLinks scripts won't run until you fix this manually.
)
popd

echo.
echo Registering DIBS scheduled tasks...
echo Dispatcher: %DISPATCHER%
echo.

REM -----------------------------------------------------------------------
REM Abe's live bids — every 5 min, 6am-6pm all week (Abe bids on weekends too).
REM This is the closest-to-real-time task, feeds the dashboard.
REM -----------------------------------------------------------------------
schtasks /create /tn "DIBS - Abe Bids Sync" ^
    /tr "cmd /c \"\"%DISPATCHER%\" sync-abe-bids-live\"" ^
    /sc minute /mo 5 ^
    /st 06:00 /et 18:00 ^
    /f
echo.

REM -----------------------------------------------------------------------
REM LamLinks solicitations — 5:30am + 1:00pm Mon-Fri.
REM DIBBS publishes overnight; 5:30am grabs those before Abe arrives.
REM 1:00pm catches same-day postings.
REM -----------------------------------------------------------------------
schtasks /create /tn "DIBS - LamLinks Sol Import AM" ^
    /tr "cmd /c \"\"%DISPATCHER%\" import-lamlinks-solicitations\"" ^
    /sc weekly /d MON,TUE,WED,THU,FRI /st 05:30 ^
    /f
echo.

schtasks /create /tn "DIBS - LamLinks Sol Import PM" ^
    /tr "cmd /c \"\"%DISPATCHER%\" import-lamlinks-solicitations\"" ^
    /sc weekly /d MON,TUE,WED,THU,FRI /st 13:00 ^
    /f
echo.

REM -----------------------------------------------------------------------
REM Awards import — 4:30am daily. Most award announcements hit LamLinks
REM overnight. Script triggers /api/dibbs/reprice at the end so suggested
REM prices refresh with new wins before Abe starts bidding.
REM -----------------------------------------------------------------------
schtasks /create /tn "DIBS - Awards Import" ^
    /tr "cmd /c \"\"%DISPATCHER%\" import-lamlinks-awards\"" ^
    /sc daily /st 04:30 ^
    /f
echo.

REM -----------------------------------------------------------------------
REM Shipping sync — every 15 min, 6am-6pm weekdays. Warehouse updates
REM tracking numbers throughout the day; we want them visible on /shipping.
REM -----------------------------------------------------------------------
schtasks /create /tn "DIBS - Shipping Sync" ^
    /tr "cmd /c \"\"%DISPATCHER%\" sync-shipping\"" ^
    /sc minute /mo 15 ^
    /st 06:00 /et 18:00 ^
    /f
echo.

REM -----------------------------------------------------------------------
REM Daily briefing — 7:00am ET weekdays, after the morning imports land.
REM Sends WhatsApp summary + PDF.
REM -----------------------------------------------------------------------
schtasks /create /tn "DIBS - Daily Briefing" ^
    /tr "cmd /c \"\"%DISPATCHER%\" send-daily-briefing\"" ^
    /sc weekly /d MON,TUE,WED,THU,FRI /st 07:00 ^
    /f
echo.

echo =====================================================================
echo All 6 tasks registered. Check:
echo    schtasks /query /tn "DIBS*" /fo TABLE
echo.
echo Logs write to C:\tmp\dibs-logs\^<script-name^>.log
echo =====================================================================
