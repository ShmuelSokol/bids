@echo off
echo Setting up DIBS scheduled tasks...

REM LamLinks Solicitation Import — 5:30am ET, Mon-Fri
schtasks /create /tn "DIBS - LamLinks Import" /tr "cmd /c npx tsx scripts/import-lamlinks-solicitations.ts >> C:\tmp\dibs-import.log 2>&1" /sc weekly /d MON,TUE,WED,THU,FRI /st 05:30 /f
echo Created: LamLinks Import (5:30am Mon-Fri)

REM Abe Live Bids Sync — every 5 minutes during business hours
schtasks /create /tn "DIBS - Abe Bids Sync" /tr "cmd /c cd C:\tmp\dibs-init\dibs && npx tsx scripts/sync-abe-bids-live.ts >> C:\tmp\dibs-bids.log 2>&1" /sc minute /mo 5 /st 06:00 /et 18:00 /f
echo Created: Abe Bids Sync (every 5min, 6am-6pm)

REM Shipping Sync — every 15 minutes during business hours
schtasks /create /tn "DIBS - Shipping Sync" /tr "cmd /c cd C:\tmp\dibs-init\dibs && npx tsx scripts/sync-shipping.ts >> C:\tmp\dibs-shipping.log 2>&1" /sc minute /mo 15 /st 06:00 /et 18:00 /f
echo Created: Shipping Sync (every 15min, 6am-6pm)

echo.
echo All tasks created! Verify with: schtasks /query /tn "DIBS*"
