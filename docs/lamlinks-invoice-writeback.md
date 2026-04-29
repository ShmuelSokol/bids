# LamLinks Invoice Write-Back (DD219 → kad/kae/k81)

How DIBS posts an AX DD219 invoice into LamLinks so the LL UI reflects it identically to a manual Abe post — without anyone clicking through the desktop app.

First successful end-to-end test: **2026-04-28**, CIN0066186 ($43.77 against contract SPE2DS-26-V-4743). Read this before touching `scripts/lamlinks-writeback-worker.ts` `writeOneInvoice()` or the `/invoicing/post-batch` UI.

## Why

Abe currently posts ~75 invoices/day, ~7 clicks each (AX → Excel paste → LL form). One of two daily time leaks identified in the workflow audit. Eliminating this returns ~1 hour/day.

## The 8-table transaction

In one SQL transaction (per queued AX invoice), mirroring Abe's manual flow:

| # | Action | Why |
|---|---|---|
| 1 | Resolve `kaj` via contract+amount | AX `CustomersOrderReference` like `SPE2DS-26-V-4743[000018925]` → strip `[…]` → `k79.cntrct_k79` → `k80.relext_k80` (±$0.01 tolerance) → `kaj.idnk80_kaj`. Filter `shpsta IN ('Shipped','Packing') AND packed_kaj='T'`. |
| 2 | Atomic `UPDATE k07.CIN_NO +1` w/ OUTPUT | LL allocates invoice numbers from `k07_tab.ss_val_k07` where `ss_key='CIN_NO'`. Use `next_val` for `kad.cin_no_kad`. **NEVER use MAX+1** — collides with the LL client's pre-reserved counter. |
| 3 | `INSERT kad` (header) | `cinsta_kad='Posted'`, `cinnum_kad=<AX 7-digit>`, `cin_no_kad=<k07 next>`, `mslval_kad=ar_val_kad=<total>`, `idnk31_kad=203`, `idnk06_kad=1`, `upname_kad='ajoseph   '`. UNIQUE on both `cin_no_kad` and `cinnum_kad`. |
| 4 | `INSERT kae` per line | `uptime_kae` + `upname_kae` are NOT NULL. `cilcls_kae='Material'`, `cil_no_kae` 1-based. UNIQUE on `(idnkad_kae, cil_no_kae)`. |
| 5 | `UPDATE kaj` shpsta='Shipped' | Idempotent — kaj may already be 'Shipped' (Abe flipped it during packing) or 'Packing' (warehouse-fresh). |
| 6 | `UPDATE ka9` per line: link + status | `idnkae_ka9 = <kae>` and `jlnsta_ka9 = 'Shipped'`. **This drives the "Invoice #" column AND the Shipped checkbox on the LL shipment screen.** Without it: blank invoice column, even though everything else exists. Map `ka9.jln_no_ka9 ↔ kae.cil_no_kae`. |
| 7 | `UPDATE k80` release | `rlsdte_k80=GETDATE(), rlssta_k80='Closed'`. **No `uptime_k80` column** — `rlsdte_k80` IS the touched-time signal. |
| 8 | `UPDATE k81` shpsta + stadte | `shpsta_k81='Shipped', stadte_k81=GETDATE() WHERE idnk80_k81=<k80> AND shpsta='Shipping'`. **This drives the STATUS LABEL on the LL shipment screen — completely separate from `kaj.shpsta_kaj`.** Without this, the checkbox flips Shipped but the status text still reads "Shipping". One k80 may have multiple k81 rows (one per CLIN); flip them all. |
| 9 | Atomic `UPDATE k07.TRN_ID_CK5 +1` | EDI transaction control number for the 810. Use `prev_val` (pre-bump) for `kbr.xtcscn_kbr` to match LL's pattern. |
| 10 | `INSERT kbr × 2` | `idnkap_kbr=24` (WAWF 810) + `idnkap_kbr=25` (WAWF 856). `xtcsta_kbr='WAWF 810 sent  '` / `'WAWF 856 sent  '` (15-char). UNIQUE on `(itttbl_kbr, idnitt_kbr, idnkap_kbr)` — at most one of each per kaj. Pre-check before INSERT. |
| 11 | `INSERT k20 × 2` | LL's WAWF upload audit log. `llptyp_k20` + `idnllp_k20` NOT NULL (use empty string + 0). `logmsg_k20` is `char(80)` — truncate. `logtxt_k20` holds the full message. |

## Critical gotchas

Each cost a debugging round during the 2026-04-28 first-live-test session:

### k81.shpsta_k81 drives the UI status label

The LL shipment screen has TWO independent visual cues:
- **Shipped checkbox** ← driven by `kaj.shpsta_kaj` + `ka9.jlnsta_ka9`
- **Status text label** ← driven by `k81.shpsta_k81`

Updating only kaj/ka9 flips the checkbox but leaves the text reading "Shipping". Discovery: full-database scan of all `INFORMATION_SCHEMA.COLUMNS` where DATA_TYPE was char/varchar and the column matched `%sta_%`/`%status%`, sampling rows for the literal values 'Shipping'/'Shipped'. Two columns matched: `kaj_tab.shpsta_kaj` (already handled) and `k81_tab.shpsta_k81` (the missing one). Diff'd k81 row of our kaj vs Abe's manual posts — only this one field differed.

### k07 is the canonical counter — never MAX+1

LL's client preallocates IDs from `k07_tab` at session/form open. Using `MAX+1` from a script collides with whatever the client has already reserved (per the bid-writeback discovery in `lamlinks-writeback.md`). The atomic pattern:

```sql
UPDATE k07_tab WITH (UPDLOCK, ROWLOCK)
   SET ss_val_k07 = CAST(TRY_CAST(LTRIM(RTRIM(ss_val_k07)) AS BIGINT) + 1 AS VARCHAR(32)),
       uptime_k07 = GETDATE()
   OUTPUT deleted.ss_val_k07 AS prev_val,
          inserted.ss_val_k07 AS next_val
   WHERE LTRIM(RTRIM(ss_key_k07)) = '<KEY>'
     AND LTRIM(RTRIM(ss_tid_k07)) = 'G'
```

- `CIN_NO`: use `next_val` for `kad.cin_no_kad`.
- `TRN_ID_CK5`: use `prev_val` for `kbr.xtcscn_kbr` (LL stores the most-recently-allocated value, not the next-free).

### kae requires uptime_kae + upname_kae

NOT NULL columns the obvious INSERT tutorials miss. Worker initially failed with "Cannot insert NULL into uptime_kae".

### k80 has no uptime_k80

Only `rlsdte_k80` (release date) acts as a modified-time signal. Don't add `uptime_k80` to the UPDATE.

### k20 needs llptyp_k20 + idnllp_k20 + truncation

`logmsg_k20` is `char(80)`. WAWF log strings exceed this — truncate before INSERT. `logtxt_k20` is the full text. Both `llptyp_k20` (empty string OK) and `idnllp_k20` (0 OK) are NOT NULL.

### kaj.shpsta may be 'Packing'

Warehouse-fresh kajs come in as `Packing`; Abe's manual flow flips them to `Shipped` as part of posting. The worker's `UPDATE kaj` is idempotent — it accepts both states.

### kbr UNIQUE collision

`UNIQUE(itttbl_kbr, idnitt_kbr, idnkap_kbr)` means at most ONE 810 (kap=24) and ONE 856 (kap=25) per kaj. Pre-check before INSERT to give a clear error rather than letting the constraint throw mid-transaction.

## Lifecycle (`lamlinks_invoice_queue` table)

```
pending      ← Import enqueues from AX (Abe review state)
   │
   ▼ (Post All button)
approved     ← worker drains
   │
   ▼ (worker locks)
processing
   │
   ▼ (transaction commits)
posted       ← terminal; ll_idnkad set
```

Errors → `error` with `error_message`. CHECK constraint must include `'approved'` — initial schema missed this; fixed via `scripts/sql/fix-invoice-queue-state-check.sql`.

## Two-click UI: `/invoicing/post-batch`

1. **Import** — `POST /api/invoicing/import` enqueues an `import_dd219_invoices` rescue action. The daemon worker runs `scripts/pull-ax-dd219-invoices-today.ts` + `scripts/_premark-already-invoiced.ts` to pull AX invoices and pre-mark any already posted (so Abe's manual posts don't show as pending).
2. **Post All** — bulk pending → approved; worker drains the queue.

Per-row controls:
- 🧪 **Test this** — process one row through the worker as a canary.
- ✕ **Skip** — mark a row as skipped (e.g., when Abe already posted it manually and the pre-mark missed).
- **Refresh from LL** — re-runs `_premark-already-invoiced.ts` to sync queue state with LL truth without re-importing from AX.

UI auto-refreshes while in-flight; first-pending row is highlighted with an amber ring.

## Verified state of CIN0066186 (2026-04-28)

After all fixes:

| Field | Value |
|---|---|
| `kad.cinnum_kad` | `0066186` |
| `kad.cinsta_kad` | `Posted` |
| `kad.cin_no_kad` | `254718` (from k07.CIN_NO) |
| `kae.idnkae_kae` | `307691` |
| `kaj.idnkaj_kaj` | `353349` |
| `kaj.shpsta_kaj` | `Shipped` |
| `ka9.idnka9_ka9` | `358459` |
| `ka9.idnkae_ka9` | `307691` (linked) |
| `ka9.jlnsta_ka9` | `Shipped` |
| `k80.idnk80_k80` | `224330` |
| `k80.rlssta_k80` | `Closed` |
| `k81.idnk81_k81` | `307787` |
| `k81.shpsta_k81` | `Shipped` |
| `kbr` × 2 | `559243` (810, xtcscn=511557), `559244` (856, xtcscn=0) |
| `k20` × 2 | WAWF 810/856 log entries |

Pending external confirmation: DLA acknowledgement email for 810/856.

## Referenced files

- `scripts/lamlinks-writeback-worker.ts` — `processInvoiceQueue()` + `writeOneInvoice()`
- `scripts/pull-ax-dd219-invoices-today.ts` — AX → queue
- `scripts/_premark-already-invoiced.ts` — LL kad scan → mark queue rows posted
- `scripts/sql/lamlinks-invoice-queue.sql` — table DDL
- `scripts/sql/fix-invoice-queue-state-check.sql` — CHECK constraint patch
- `src/app/invoicing/post-batch/page.tsx` + `post-batch-client.tsx` — UI
- `src/app/api/invoicing/{import,post-all,queue-rows,skip-row,refresh-from-ll}/route.ts`
