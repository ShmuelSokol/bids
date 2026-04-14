# DIBS Windows scheduled tasks

These four syncs can't run on Railway because LamLinks SQL Server uses
Windows Authentication (trusted connection from a domain-joined box).
This folder registers them with Windows Task Scheduler on the office
Windows machine so they run automatically.

## Tasks

| Task | Script | Schedule |
|------|--------|----------|
| `DIBS - Abe Bids Sync` | `sync-abe-bids-live.ts` | every 5 min, 6am-6pm all week |
| `DIBS - LamLinks Sol Import AM` | `import-lamlinks-solicitations.ts` | 5:30am Mon-Fri |
| `DIBS - LamLinks Sol Import PM` | `import-lamlinks-solicitations.ts` | 1:00pm Mon-Fri |
| `DIBS - Awards Import` | `import-lamlinks-awards.ts` | 4:30am daily (also triggers `/api/dibbs/reprice`) |
| `DIBS - Shipping Sync` | `sync-shipping.ts` | every 15 min, 6am-6pm weekdays |
| `DIBS - Daily Briefing` | `send-daily-briefing.ts` | 7:00am Mon-Fri (after imports) |
| `DIBS - Competitor Awards Import` | `import-lamlinks-competitor-awards.ts` | 5:00am daily — pulls competitor wins from LamLinks `kc4_tab` (one SQL query, much faster than scraping DIBBS) |

## Install (one-time)

1. Make sure the repo is cloned to **exactly** `C:\tmp\dibs-init\dibs`
   (the paths in these scripts are absolute).
2. Make sure the `.env` file is present with `SUPABASE_SERVICE_ROLE_KEY`,
   `TWILIO_*`, `MASTERDB_API_KEY`, etc.
3. Make sure the native SQL Server driver is installed (one-time):
   ```cmd
   cd C:\tmp\dibs-init\dibs
   npm install --no-save mssql msnodesqlv8
   ```
   These packages can never live in `package.json` (they'd crash the
   Railway Linux build), so they're installed with `--no-save` here.
   `install-tasks.bat` does this for you, but if you ever wipe
   `node_modules` you'll need to rerun the line above.
4. Make sure `npx tsx` works:
   ```cmd
   npx tsx scripts\sync-abe-bids-live.ts
   ```
   If that succeeds and writes a row to `abe_bids_live`, you're good.
4. Open an **Administrator** cmd prompt (right-click cmd → Run as administrator).
5. Run the installer:
   ```cmd
   cd C:\tmp\dibs-init\dibs\scripts\windows
   install-tasks.bat
   ```

   **If you're in PowerShell instead of cmd**, prefix with `.\`:
   ```powershell
   cd C:\tmp\dibs-init\dibs\scripts\windows
   .\install-tasks.bat
   ```
   PowerShell won't run scripts from the current directory without `.\`.
   The same applies to `check-status.bat` and `uninstall-tasks.bat`.

All tasks run under the currently logged-in user, which is the only
identity with Windows Auth access to the LamLinks SQL Server.

## Verify

```cmd
check-status.bat
```

Shows Last Run Time, Last Result, and Next Run for every DIBS task.
`Last Result = 0` is success. Anything else failed — check the log.

## Logs

Every run appends to `C:\tmp\dibs-logs\<script-name>.log`. Each entry
is timestamped so you can see when a task last did something useful.

## Uninstall

```cmd
uninstall-tasks.bat
```

## Notes

- **Laptop sleep**: Task Scheduler won't wake a sleeping machine by default.
  If the office box sleeps, add `/ri 5 /du 24:00` or configure wake-on-task
  in the Task Scheduler UI (Conditions tab → Wake the computer to run).
- **User session required**: these tasks run "only when user is logged on"
  because Windows Auth to NYEVRVSQL001 requires an interactive session.
  Don't log out the service account.
- **Rotating the logs**: nothing rotates them today. If `dibs-logs` grows
  past a few MB, archive and truncate manually. Adding logrotation is a
  TODO.
