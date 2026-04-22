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
REM Pick the user the tasks will run as.
REM
REM /it (interactive only) means the task runs inside this user's
REM already-active session — gives us the Windows Auth token for
REM LamLinks SQL access without having to store a password.
REM
REM Defaults to ERG\ssokol. Override at install time with:
REM    set DIBS_TASK_USER=ERG\someone-else
REM    install-tasks.bat
REM -----------------------------------------------------------------------
if not defined DIBS_TASK_USER set DIBS_TASK_USER=ERG\ssokol
set RUN_AS_USER=%DIBS_TASK_USER%
echo Tasks will run as: %RUN_AS_USER%  (interactive-only, /it)
echo.

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
REM OLD recurring tasks (abe-bids, shipping, ax-po-poll, invoice-state,
REM status-reconciler, lamlinks-writeback-worker) have been CONSOLIDATED
REM into a single "DIBS - Recurring Daemon" registered below. That one
REM daemon runs all of them in a single persistent process with zero
REM recurring cmd-window popups. See docs/lamlinks-writeback.md.
REM -----------------------------------------------------------------------

REM Clean up the old per-task scheduled tasks if they exist, so we don't
REM run the same sync twice. Errors (task not found) are expected on a
REM fresh machine and can be ignored.
for %%T in (
    "DIBS - Abe Bids Sync"
    "DIBS - Shipping Sync"
    "DIBS - AX PO Poll"
    "DIBS - Invoice State Sync"
    "DIBS - Status Reconciler"
    "DIBS - LamLinks Writeback Worker"
) do (
    schtasks /delete /tn %%T /f 2>nul
)
echo.

REM -----------------------------------------------------------------------
REM LamLinks solicitations — 5:30am + 1:00pm Mon-Fri.
REM DIBBS publishes overnight; 5:30am grabs those before Abe arrives.
REM 1:00pm catches same-day postings.
REM -----------------------------------------------------------------------
schtasks /create /tn "DIBS - LamLinks Sol Import AM" ^
    /tr "cmd /c \"\"%DISPATCHER%\" import-lamlinks-solicitations\"" ^
    /sc weekly /d MON,TUE,WED,THU,FRI /st 05:30 ^
    /ru "%RUN_AS_USER%" /it /f
echo.

schtasks /create /tn "DIBS - LamLinks Sol Import PM" ^
    /tr "cmd /c \"\"%DISPATCHER%\" import-lamlinks-solicitations\"" ^
    /sc weekly /d MON,TUE,WED,THU,FRI /st 13:00 ^
    /ru "%RUN_AS_USER%" /it /f
echo.

REM -----------------------------------------------------------------------
REM Awards import — 4:30am daily. Most award announcements hit LamLinks
REM overnight. Script triggers /api/dibbs/reprice at the end so suggested
REM prices refresh with new wins before Abe starts bidding.
REM -----------------------------------------------------------------------
schtasks /create /tn "DIBS - Awards Import" ^
    /tr "cmd /c \"\"%DISPATCHER%\" import-lamlinks-awards\"" ^
    /sc daily /st 04:30 ^
    /ru "%RUN_AS_USER%" /it /f
echo.

REM -----------------------------------------------------------------------
REM AX cost rebuild — 4:00am daily, BEFORE awards import. Pulls
REM PurchasePriceAgreements + ProductBarcodesV3 from D365, rebuilds
REM nsn_costs + nsn_vendor_prices with UoM persisted. Keeps suggested
REM prices and PO-gen cost waterfall aligned with the latest AX data.
REM -----------------------------------------------------------------------
schtasks /create /tn "DIBS - AX Cost Rebuild" ^
    /tr "cmd /c \"\"%DISPATCHER%\" populate-nsn-costs-from-ax\"" ^
    /sc daily /st 04:00 ^
    /ru "%RUN_AS_USER%" /it /f
echo.

REM -----------------------------------------------------------------------
REM PO ↔ Award heuristic linker — daily 5:15am. Queries AX for all
REM DD219 PO lines, resolves ItemNumber → NSN via ProductBarcodesV3,
REM matches each PO line to the most-likely award by (qty, date
REM proximity ±180d). Powers the award bucketing on /invoicing/followups.
REM -----------------------------------------------------------------------
schtasks /create /tn "DIBS - PO Award Link Sync" ^
    /tr "cmd /c \"\"%DISPATCHER%\" sync-po-award-links\"" ^
    /sc daily /st 05:15 ^
    /ru "%RUN_AS_USER%" /it /f
echo.

REM -----------------------------------------------------------------------
REM Daily briefing — 7:00am ET weekdays, after the morning imports land.
REM Sends WhatsApp summary + PDF.
REM -----------------------------------------------------------------------
schtasks /create /tn "DIBS - Daily Briefing" ^
    /tr "cmd /c \"\"%DISPATCHER%\" send-daily-briefing\"" ^
    /sc weekly /d MON,TUE,WED,THU,FRI /st 07:00 ^
    /ru "%RUN_AS_USER%" /it /f
echo.

REM -----------------------------------------------------------------------
REM Competitor awards import — 5:00am daily. Pulls kc4_tab from LamLinks
REM (one SQL query, much faster than scraping DIBBS). Includes both our
REM own wins and competitor wins; data_source tags which is which.
REM -----------------------------------------------------------------------
schtasks /create /tn "DIBS - Competitor Awards Import" ^
    /tr "cmd /c \"\"%DISPATCHER%\" import-lamlinks-competitor-awards\"" ^
    /sc daily /st 05:00 ^
    /ru "%RUN_AS_USER%" /it /f
echo.

REM -----------------------------------------------------------------------
REM UNIFIED RECURRING DAEMON — ONE persistent process at logon that runs
REM all the previously-scheduled recurring syncs on their own cadence.
REM Replaces:
REM   - DIBS - Abe Bids Sync (every 5 min)
REM   - DIBS - Shipping Sync (every 15 min)
REM   - DIBS - AX PO Poll (every 5 min)
REM   - DIBS - Invoice State Sync (every 15 min)
REM   - DIBS - Status Reconciler (every 15 min)
REM   - DIBS - LamLinks Writeback Worker (persistent --loop)
REM
REM Why: per-task scheduled entries each pop a minimized cmd window when
REM they fire. With five of them cycling every 5-15 min the user gets
REM hundreds of popups per workday. This consolidates to ONE persistent
REM process that spawns child syncs internally via child_process.spawn
REM with windowsHide:true — zero recurring popups.
REM
REM Also runs 24/7 (no 6am-8pm window), so Abe's late-night or weekend
REM work syncs live.
REM
REM If the daemon dies, log out and back in, OR run:
REM   schtasks /run /tn "DIBS - Recurring Daemon"
REM -----------------------------------------------------------------------
schtasks /create /tn "DIBS - Recurring Daemon" ^
    /tr "cmd /c start \"DIBS Recurring Daemon\" /min \"%DISPATCHER%\" dibs-recurring-daemon" ^
    /sc onlogon ^
    /ru "%RUN_AS_USER%" /it /f
echo.

echo =====================================================================
echo All tasks registered. Check:
echo    schtasks /query /tn "DIBS*" /fo TABLE
echo.
echo Logs write to C:\tmp\dibs-logs\^<script-name^>.log
echo =====================================================================
