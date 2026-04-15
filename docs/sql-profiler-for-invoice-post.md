# Capturing the LamLinks "Post Invoice" SQL — quick guide for Yosef

We need to know what SQL the LamLinks client fires when you click the Post button on an invoice. Once we have it, DIBS can replay it programmatically for bulk-post (and then wire a "Post all ready" button into `/invoicing/monitor`).

## Setup (one-time)

1. Open **SQL Server Profiler** on any machine with SSMS installed
2. **File → New Trace**
3. Connect to `NYEVRVSQL001` (Windows Auth)
4. On the "Trace Properties" dialog's **Events Selection** tab:
   - Uncheck **Audit Login / Audit Logout / ExistingConnection** (too noisy)
   - Keep these checked:
     - **RPC:Completed**
     - **SQL:BatchCompleted**
     - **SQL:StmtCompleted**
   - Click **Column Filters…** → **DatabaseName** → **Like** → `llk_db1` → OK
   - Click **Column Filters…** → **LoginName** → **Like** → `%ajoseph%` (or your domain login if you're doing the click) → OK
5. Click **Run**

Profiler will start streaming every SQL statement that hits `llk_db1` from Abe's session. It'll be a lot but we only care about the 1-2 seconds around the button click.

## Capture the post action

1. Profiler is running (from step 5 above)
2. Open LamLinks, pick an invoice you'd normally Post anyway
3. Click **File → Pause** in Profiler (or just be ready to stop) — this is so the click's statements don't get lost in scroll
4. Actually click **Post** in LamLinks
5. Wait 2-3 seconds
6. Click **File → Pause** in Profiler
7. Scroll back to find the statements that fired right at your click moment — the TextData column shows the SQL

Expected shapes:
- **Simple case (most likely)**: `UPDATE kad_tab SET cinsta_kad = 'Posted' WHERE idnkad_kad = <id>` — maybe with a few side UPDATES to other tables for the audit trail
- **Stored proc case**: `exec sp_PostInvoice @id = <id>` or similar
- **Trigger case**: the UPDATE above plus automatic writes to a history table

## What to send back

Copy/paste (or screenshot) the block of statements that fired between your click and the next idle gap. Even if there are 10-20 lines, send them all — DIBS needs the exact ordering.

## Bonus probe (optional)

Same setup, but before clicking Post, run this in SSMS against `llk_db1` — gives us a current-state snapshot of the target invoice:

```sql
SELECT idnkad_kad, cinnum_kad, cinsta_kad, ar_val_kad, uptime_kad
FROM kad_tab
WHERE idnkad_kad = <the invoice id you're about to post>;
```

Then after Post, run the same SELECT and send both results. That tells us exactly which columns changed alongside `cinsta_kad` — sometimes there are related fields that flip together (transmit date, posting user, etc.) and we want to replicate all of them.

## Why we need this

Tier-2 of the WAWF visibility plan is a "Post all ready invoices" button. Today Abe has to click Post on each invoice individually — Yosef has seen cases where hundreds of invoices got saved but never Posted and never paid. One click that fires the same SQL for every `Not Posted` invoice would eliminate that class of lost revenue entirely.

## If Profiler is blocked

If IT doesn't give you SQL Profiler, **Extended Events** is the modern replacement and runs without the GUI. Ask someone (or ping me) if you want to go that route — it's a single T-SQL script that captures the same thing.
