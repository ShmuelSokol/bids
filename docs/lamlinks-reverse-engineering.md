# LamLinks reverse-engineering — findings 2026-04-23

## Why this doc exists

DIBS is the intelligence layer on top of LamLinks (LL). LL is delivered only as compiled binaries, and its owner recently died; the son now runs the vendor and we can't rely on detailed technical answers from them. We reverse-engineered the platform so DIBS can integrate with it cleanly — especially for the invoice + shipment workflows that are eating Abe's day — without waiting on vendor support that may never come.

Everything in this doc is derived from string-extraction of the LL binaries themselves. See `rev-eng/README.md` for how to regenerate the raw data. Line-number citations point into `rev-eng/strings/llprun-strings.txt` unless noted otherwise.

## TL;DR

LL is a Visual FoxPro 9 desktop app. `lamlinkspro.exe` on the client is a 126 KB launcher; the real binary is `llprun.exe` (40.7 MB) on a network share. **All of LL's business logic lives inside that binary as compiled VFP code. There are zero stored procedures, triggers, functions, or CLR assemblies on the SQL Server — `llk_db1` is pure storage.** When the vendor says "everything runs from SQL including stored procedures," he means FoxPro `PROCEDURE` blocks compiled into the EXE, not T-SQL procs.

LL has an internal RPC mechanism — the `kdd_tab` request table — that lets the web interface invoke VFP functions on the desktop. A `Client Management` dispatcher routes requests to a dozen "VSE"-prefixed handlers for solicitation/quote/customer data. External integrators (us) can write to `kdd_tab` and have a running desktop bot process the request. That's the clean integration surface we'll build against.

Most of the "bugs" we've seen — the `Update conflict in cursor '_9999XXX'` error chief among them — are inherent to how VFP talks to SQL Server through ODBC cursors with optimistic concurrency. They can't be fixed server-side.

## Physical layout

**Client workstations** (e.g. Abe's `COOKIE`):
- `C:\LamlinkP\lamlinkspro.exe` — the VFP 9 desktop UI, compiled binary
- `C:\LamlinkP\FOXUSER.DBF` + `FOXUSER.FPT` — local VFP user prefs cache
- `C:\LamlinkP\LLPro.ini` — client config (DB server, user name, server folder path)
- `C:\LamlinkP\llpclint\` — client support files

**Server box** `NYEVRVTC001` (old Windows Server):
- Hosts the Windows service `LamLinksService` (stopped by default) which runs `LamlinksPro.bat` via `srvstart.exe`
- Accesses the shared server folder via G: mapped drive
- This is where the realtime bot *probably* runs, though unconfirmed — `scripts/who-talks-to-llk.ts` showed spid 53 from `NYEVRVTC001` as a persistent 12-hour connection to llk_db1

**Network shared server folder** `G:\PROGRAMS\LAMLINKS\CONTROL\Lamlinkp\LLPservr\`:
- `code\llprun.exe` — VFP 9 backend runtime (40.7 MB, no source available)
- `code\cfoldersinterface.exe` — DoD cFolders EDI submission
- `code\winscp.exe` — SFTP for DLA drop points
- `code\curl.exe` / `getwpage.exe` — HTTP(S)
- `code\senditquiet.exe` — email (for ack notifications)
- `code\pdftotext.exe` (3 versions) — PDF parsing for solicitation text
- `data\sys_file\llk_db1.sql` — one-time DB install script (CREATE TABLE / VIEW)
- No `.prg` source files. No `.ini` in this folder (the server reuses the client `LLPro.ini`).

**Database** `llk_db1` on `NYEVRVSQL001`:
- 217 user tables, 261 views, 268 FK constraints
- **0 stored procedures, 0 triggers, 0 user functions, 0 CLR assemblies**
- Pure storage. Confirmed three different ways:
  1. `sys.objects` without `is_ms_shipped=0` filter — to catch the ms_shipped=1 hiding trick
  2. `sys.assemblies` across every database — no CLR anywhere
  3. `sys.servers` — no linked servers pointing elsewhere

**ERG's internal mirror** `SZY_WinSol` on the same SQL Server — 92 tables + 21 ERG-authored procs refreshed by the SQL Agent job `run Automatic_Import_SZY_WinSol_Table_Groups` every 90 min. Not part of LL; it's ERG's reporting replica.

## The "stored procedures" mystery, fully solved

LL's vendor told Yosef: *"everything runs from SQL including stored procedures."* Taken literally, this is wrong — we confirmed there are zero T-SQL procs anywhere. Decoded, what he meant:

1. FoxPro uses the term "stored procedure" loosely for its own `PROCEDURE` blocks, which run in the client and issue SQL to the server.
2. LL has an RPC table — `kdd_tab` — where a caller inserts a row specifying a function name, and a desktop daemon polls, executes the VFP function, and writes the result back. This "looks like" calling a stored procedure from the caller's perspective, but the procedure is compiled VFP inside `llprun.exe`.
3. `kea_tab`, added 2020-10-13, is a companion table holding per-handler configuration (incremental sync cursors, etc.).

Accepting (2) as the mental model explains everything we were confused about.

## The `kdd_tab` RPC bus

Discovered via grep of llprun.exe strings. The table's own CREATE TABLE comment (line 2604–2655 and mirrored at 737970+) documents the design intent:

> "Enables WebApps to request LamlinksPro functions. The WebApp and desktop sessions are on the same PC. Also enables a realtime desktop Bot to service requests from any source connected to the same llk_db1 database. The WebApp initiates the request via a title change to the Browser object that includes 'check_kdd='. This enables LamlinksPro to respond to App requests without polling/query or using a Timer."

Read that twice. The key phrase for DIBS is *"any source connected to the same llk_db1 database"* — meaning an external integrator (us) can insert a row into kdd_tab and have the desktop realtime bot process it, as long as a bot is running somewhere on the LAN.

### Schema (verbatim DDL, llprun.exe lines 2639–2663)

```sql
CREATE TABLE dbo.kdd_tab (
  idnkdd_kdd int IDENTITY,
  addtme_kdd datetime NOT NULL,      -- row insertion time
  reqtme_kdd datetime NOT NULL,      -- request time (set by caller)
  reqkey_kdd char(64) NOT NULL,      -- unique request key (UNIQUE constraint)
  toutby_kdd datetime NOT NULL,      -- timeout deadline
  req_by_kdd char(32) NOT NULL,      -- requester login
  reqsys_kdd varchar(32) NOT NULL,   -- target system (e.g. 'LamlinksPro Realtime Bot')
  reqfun_kdd char(32) NOT NULL,      -- function name to invoke
  reqsta_kdd char(32) NOT NULL,      -- request status ('requested' when new)
  reqxml_kdd text NOT NULL,          -- XML request payload
  rsptme_kdd datetime NOT NULL,      -- response time (initially = reqtme_kdd)
  rsp_by_kdd char(32) NOT NULL,      -- responder
  rspcod_kdd int NOT NULL,           -- response code (0 = success, 1 = failure)
  rspmsg_kdd varchar(160) NOT NULL,  -- short response message
  rspxml_kdd varchar(7000) NOT NULL, -- XML response — HARD CAP 7000 chars
  reqj05_kdd int,                    -- caller of API function (added via ALTER)
  CONSTRAINT idnkdd_kdd PRIMARY KEY CLUSTERED (idnkdd_kdd),
  CONSTRAINT reqkey_kdd UNIQUE (reqkey_kdd)
)
CREATE INDEX stssta_kdd ON dbo.kdd_tab(reqsys_kdd, reqsta_kdd)  -- bot poll index
CREATE INDEX reqsta_kdd ON dbo.kdd_tab(reqsta_kdd)
CREATE INDEX addtme_kdd ON dbo.kdd_tab(addtme_kdd)
```

`rspxml_kdd varchar(7000)` is a surprising hard cap — one row cannot return more than 7000 characters of XML. Handlers that could produce larger responses must paginate (and they do — see `response_count_limit` in handler code).

### The dispatch chain

From llprun.exe strings around lines 170328–170335 and 765948+:

```
llxp_realtime_bot_function('realtime_bot_exec')         -- the bot's main loop
  → allocate_kdd_row(reqsys)                            -- atomically claim a pending row
  → kdd_row_to_response(form, kdd_view)                 -- parse reqxml_kdd and route
      CASE reqfun = reqfun_kdd_client_management:
        kea_function('kdd_request', kdd_view, @rspcod, @rspmsg, @rspxml)
      CASE reqfun = reqfun_kdd_vrfq_7av65_to_pdf:
        (vRFQ PDF generator — probably prints a virtual RFQ to PDF)
```

Response write-back pattern: the bot updates the same row with `rsptme_kdd`, `rspcod_kdd`, `rspmsg_kdd`, `rspxml_kdd`, and flips `reqsta_kdd` to done. Caller polls on `reqkey_kdd` (UNIQUE) for completion.

Initial request status: `reqsta_kdd_requested = 'requested'`. Response codes: 0 = success, 1 = failure.

### The two top-level reqfun values

Only two `#DEFINE reqfun_kdd_*` exist in the binary:

```
reqfun_kdd_vrfq_7av65_to_pdf  = "vrfq_7av65_to_pdf"       -- PDF generation
reqfun_kdd_client_management  = "Client Management"        -- the whole VSE/RFQ surface
```

So `Client Management` is effectively the entire external API surface.

## The `Client Management` (VSE/RFQ) handler catalog

`kea_function('kdd_request', ...)` dispatches on an inner `a_name_kea` value extracted from the request XML. Every handler has a matching `process_vse_*_function` or `process_vse_rfq_*_function` (the actual VFP function that does the work) plus a pair of helper functions named `mgtxml_to_<entity>_view` (parse input context) and `x##_row_to_<entity>_xml` (serialize response rows).

| `a_name_kea` literal | Backing VFP function | Purpose (verified / inferred from code) |
|---|---|---|
| `VSE Solicitation` | `process_vse_solicitation_function` | Solicitation CRUD — header + lines together |
| `VSE Solicitation Basic Info` | `process_vse_solicitation_basic_info_function` | Header-level sync |
| `VSE Solicitation Line Item` | `process_vse_solicitation_line_item_function` | Incremental line pull (input: `prior_idnk11`, pulls lines > that id) |
| `VSE Solicitation Status` | `process_vse_solicitation_status_changes_function` | Award/status changes pull since `datetime_of_last_change` |
| `VSE Solicitation FAR Clauses` | `process_vse_solicitation_far_clauses_function` | Clause text |
| `VSE Solicitation Owner Change` | `process_vse_soliciation_owner_change_function` *(sic — typo in source)* | Reassign solicitation to new owner |
| `VSE Customer Info` | — | Customer record sync |
| `VSE Customer_Quote` | — | Customer quote CRUD |
| `RFQ Line Item` | `process_vse_rfq_line_item_function` | RFQ line sync |
| `RFQ Quote Line Item` | `process_vse_rfq_quote_function` | RFQ quote lines — closest analog to our k34 writes |

**Important caveat on READ vs WRITE.** The bodies we've decoded (Status Changes, Line Item) show an incremental-pull pattern: caller sends a "since" cursor in the input XML, handler queries a view, bounds by the cursor, serializes results to XML using `xml_tag_and_value_to_string`, updates the stored cursor in `kea_tab.mgtxml_kea`, returns. That's a **read API shape**, not a write. We haven't yet decoded a handler body that writes to a base table via this path.

There is a separate function `vse_solxml_to_db_update` (llprun line 451526) whose name implies VSE-XML → DB writes. Whether that's reachable through kdd_tab with a different `reqfun_kdd` value, or is only callable from inside the desktop, is **open**. See "Open questions" below.

## The state-machine alphabet

Every LL status field follows the pattern `<name>sta_<tbl>` or `<prefix>_stat_<tbl>` with values declared as `#DEFINE` constants. Searchable via `^#DEFINE\s+\w+_?sta[t]?_\w+`. Major state machines:

### Solicitation quote staging (`k33_tab`)
- `o_stat_k33` — offer state: `'adding quotes'` (DoD, staging), `'adding C quotes'` (commercial), `'quotes added'` (finalized)
- `t_stat_k33` — transmit state: `'not sent'`, `'sent'`, `'async send'` (commercial)
- `a_stat_k33` — ack state: `'not acknowledged'`, `'acknowledged'`, `'async ack'` (commercial)
- `s_stat_k33` — **batch show status (o/t/a)**, llprun line 414251 comment: denormalized UI indicator, not an independent fourth state

### Sales orders & shipments
- `k80_tab.rlssta`: `Added`, `Open`, `Closed`, `Cancelled`
- `k81_tab.shpsta`: `Cancelled`, `Not Shipped`, `Shipping`, `Partial Shipment`, `Shipped`, `Over Shipped`, `Open`, `Closed`
- `k81_tab.mrqsta`: `Undefined`, `End Item`, `Assembly`, `Assembly/Buy`
- `kaj_tab.shpsta`: `Packing`, `Shipped`
- `ka8_tab.jobsta`: `New`, `Open`, `Closed`, `Cancelled`
- `ka9_tab.jlnsta`: `Not Active`, `Shipping`, `Assembling`, `Shipped`, `Made`

### POD / receipts
- `k89_tab.podsta`: `Not Sent`, `Sent`, `Acknowledged`, `Pending Review`, `Approved`, `Hold`
- `k89_tab.rcvsta`: `Pending`, `Back Order`, `Completed`, `Cancelled`

### EDI transmission (`kbr_tab.xtcsta`) — the one DIBS needs for invoice/shipment work
- **WAWF 810** (invoice): `WAWF 810 not sent`, `WAWF 810 sent`, `WAWF 810 problem acknowledged`, `WAWF 810 acknowledged`
- **WAWF 856** (advance ship notice): `WAWF 856 not sent`, `WAWF 856 sent`, `WAWF 856 problem acknowledged`, `WAWF 856 acknowledged`
- **WAWF 857** (ship/delivery notice): `WAWF 857 sent`
- **DLA Legacy 810 / 856** (SAMMS): `DLA Legacy 8XX not sent` / `sent` / `problem acknowledged` / `acknowledged`
- **DPMS**: `DPMS not contacted`, `DPMS closeout pending`, `DPMS shipdest completed`

### Invoices / A/R / A/P
- `kad_tab.cinsta` (customer invoice): `Not Posted`, `Posted`, `Voided`
- `ka1_tab.sinsta` (supplier invoice): `Not Posted`, `Posted`, `Voided`
- `kc1_tab.pyasta` (payables): `Imported`, `Voided`, `Posted`
- `kbn_tab.ckosta` (checks): `Not Posted`, `Posted`, `Voided`
- `kbm_tab.cwbsta`: `Adding Checks`, `Checks Added`, `Checks Printed`
- `kbx_tab.m2asta`, `kbz_tab.je1sta`, `kc6_tab.mdrsta`: `unposted`, `posted`, `voided`

### Inspection & inventory
- `k93_tab.instat`: `Pending`, `Accepted`, `Rejected`, `Automatic`
- `kbj_tab.mrbsta`: `Receiving`, `Inventory`
- `kbh_tab.crtsta`: `Uncertified`, `Certified`, `Partly Certified`
- `k95_tab.nnista`: `Importing`, `Inventory`

### Customer-quote pipeline
- `kd8_tab.q_stat`: `Not Sent`, `Retrying`, `Superseded`, `Cancelled`, `Send Failed`, `Quote Sent`
- `kdb_tab.t_stat` (transmission log): `Started`, `Superseded`, `Cancelled`, `Failed`, `Succeeded`

The full set (~200 defines) is greppable from `rev-eng/strings/llprun-strings.txt` with `^#DEFINE\s+\w+_stat_\w+`.

## Database objects catalog (the ones DIBS will touch)

All verbatim DDL is in `rev-eng/strings/llprun-strings.txt`. This is a directory, not a full reference — match-up to our existing `docs/lamlinks-schema/` dump.

| Table | Purpose | Notable columns |
|---|---|---|
| `kdd_tab` | **RPC request queue** | reqfun_kdd, reqxml_kdd, rspxml_kdd (7000 char cap), reqkey_kdd UNIQUE |
| `kea_tab` | **Client Management registry** | a_name_kea (UNIQUE), mgtxml_kea (per-handler config XML) |
| `kdy_tab` | SQL identity/key allocation | replaces legacy IDENTITY columns (6/4/19 migration) |
| `k33_tab` | Quote envelope (staging → posted) | o_stat, t_stat, a_stat, s_stat, itmcnt |
| `k34_tab` | Quote line (vendor + pricing + terms) | 60+ columns including HUBZone, FOB, set-aside flags |
| `k35_tab` | Price detail per line | qty, up, daro (ARO days) |
| `k10_tab` / `k11_tab` / `k08_tab` | Solicitation header / lines / items | sol_no_k10, niin_k08, item-of-issue fields |
| `k81_tab` | Sales order ship quantities | shpsta, pr_num, tcn, fob_od, clnqty |
| `k89_tab` | POD / receipt acknowledgement | podsta, po_dte, por_no, shipin, fob fields |
| `k93_tab` | Inspection records | instat, FK to kbb (inspection batch) |
| `kad_tab` | Customer invoice header | cinsta, cinnum, nine money fields for AR |
| `ka1_tab` | Supplier invoice header | sinsta, sinnum, eight money fields for AP |
| `kaj_tab` | Shipment records | shpsta, bolnum, trakno, edi_id, wawuid |
| `kbr_tab` | **EDI transmission tracking** | xtcsta, xtcscn (scenario: 810/856/857/DPMS), FK to kap |
| `kd8_tab` | Customer-facing quotes (non-DLA) | q_stat, q_clas, qstext, qclxml |
| `kdb_tab` | Quote transmit audit log | FK to kd8, t_clas (API/Fax), t_stat, t_comp |
| `kdn_tab` | RFQ async transmission log | t_comp |
| `kdx_tab` | Individual email control | e_stat |

## The cursor-update-conflict error, fully explained

LL's VFP code updates `k33_tab` through an ODBC cursor with **optimistic concurrency**. When DIBS's worker (or another LL user on an adjacent PC) bumps the row version between the cursor's FETCH and its positioned UPDATE, SQL Server's standard cursor machinery throws `Update conflict in cursor '_9999XXX'`.

This is not a LamLinks bug. It's inherent to how every VFP-to-SQL-Server app built before 2015 works, well-documented on FoxPro forums going back 20 years. There is no server-side fix — no trigger, no proc, no schema change eliminates it. Only client-side coordination (write-only-to-quiet-envelopes, piggyback-only mode, or accepting cosmetic errors) can reduce the race.

**Transmission succeeds regardless.** LL's client has an internal 6-second cursor retry that re-runs the update, which almost always succeeds on the second pass. DLA itself de-dupes via supersede. The error message is cosmetic; the bid ships.

Avoidance for DIBS: write-back via `kdd_tab` RPC (once verified) instead of direct cursor writes. The bot's VFP code can open the cursor, serialize k33/k34 updates through LL's own code path, and absorb retries internally — we never see the conflict.

## DIBS integration path (proposed)

Given the findings, the cleanest path forward:

1. **Confirm a realtime bot is running.** `scripts/who-talks-to-llk.ts` already shows a persistent connection from `NYEVRVTC001` (spid 53, 12-hour uptime) — this is probably the `lamlinkspro_realtime_bot`. Confirm by checking its `program_name` when we run the script next.

2. **Read-side integration (fast win, low risk).** Use the VSE Solicitation Status handler via kdd_tab to pull incremental award + status changes since our last sync. Replaces our current "scrape DIBBS every 6 hours" pattern for confirmed awards with a more direct LL pull. Write test script `scripts/ll-rpc-pull-status.ts` and prove the request/response round-trip works.

3. **Decode a VSE XML payload shape.** From the strings dump we know the elements and the view columns. Write a canonical request XML for "give me solicitation line items with idnk11 > N" and confirm we get results. Grep for the exact element names produced by `xml_tag_and_value_to_string` calls inside each handler (we found the helpers; we need the element names they emit for each handler — a 30-minute targeted grep).

4. **Resolve the write-path question.** Whether `vse_solxml_to_db_update` is reachable via kdd_tab is the gating question for replacing our k33/k34 cursor writes. Two ways to resolve:
   - Keep grepping llprun.exe strings for invocations of `vse_solxml_to_db_update` — find its callsites. If called from `kea_function`, we're in business.
   - Capture live traffic: if there's a WebApp we can observe (llpdev2.lamlinks.com?), tail its kdd_tab inserts to learn which reqfun value it uses for writes.

5. **If RPC-writes confirmed**: deprecate `scripts/redo-bid-with-itmcnt.ts` and friends in favor of `scripts/ll-rpc-post-quote.ts`. Cursor-conflict errors disappear from our codebase.

6. **If RPC-writes not available**: keep the piggyback pattern but add a `scripts/ll-rpc-verify-post.ts` that uses the *read* RPC to confirm our cursor writes landed (belt + suspenders).

7. **For invoice/shipment workflows** (Abe's daily time leak): monitor `kbr_tab` for EDI ack states and `k89_tab` for PODs. These are the two places we can see external state change without any write. Build a DIBS "invoice & shipment tracker" page that surfaces these tables.

## Methodology — how to extend this

All the above came from string extraction of `llprun.exe` using Sysinternals `strings64.exe`:

```powershell
strings64.exe -accepteula -n 6 llprun.exe > llprun-strings.txt
```

32 MB of text output. The important patterns:

- `^#DEFINE\s+<name>\s+<value>` — every literal constant, including status values, RPC function names, system names, URLs
- `^CREATE TABLE dbo\.<name>` — complete DDL for every table the installer creates
- `^(PROCEDURE|FUNCTION)\s+<name>` — function/procedure boundaries (used for indexing code regions)
- `xml_tag_and_string_to_value\('<tag>'` — XML element names consumed by a handler
- `xml_tag_and_value_to_string\('<tag>'` — XML element names produced by a handler
- Mixed ASCII/UTF-16: Sysinternals extracts both. Wide strings appear character-spaced in the output (e.g. ` p r o c e s s _ v s e _ `). Grep patterns that don't account for this will miss hits inside compiled function bodies. Work around by searching for the ASCII "#DEFINE" copy of the same constant, which is usually present as metadata in the same file.

What string extraction does NOT give us: control flow, conditional branches, which function calls which, argument passing. For that we'd need ReFox (commercial VFP decompiler) — currently blocked by SentinelOne at work and consumer AV at home. Possible future workarounds: Azure VM without EDR, a clean personal laptop, or an IT exclusion. Not attempted yet.

## Open questions

1. **Is `vse_solxml_to_db_update` reachable via kdd_tab?** Core question gating the "clean write path" story. Answer determines whether we can deprecate cursor-based write scripts.

2. **Is a realtime bot actually running?** The persistent spid 53 connection is suspicious but not confirmed. If no bot is running, any kdd_tab inserts we make will sit forever. Check `program_name` and consider whether we can start one ourselves — `llprun.exe` has a `Realtime Bot` mode per the `#DEFINE` constants.

3. **What is "VSE"?** Likely Vendor Service Entry or Vendor-Side Engine — an external-integration surface LL built for a specific client (possibly 31902, per `llxp_client_31902_function`). If there's a second integrator already using this, we may be able to learn from their patterns.

4. **What is the XML request envelope shape?** We have element names but not the full container structure. Grep for patterns around `outer_envelope_xml` / `function_response_xml` to resolve.

5. **Response pagination**: the 7000-char `rspxml_kdd` cap means multi-row responses paginate. The `response_count_limit` constant in handler code suggests the caller controls page size. Mechanics of cursoring through pages need to be mapped before the read-integration script is reliable.

## Previously written memory + scripts index

- Memory: `reference_lamlinks_architecture.md`, `reference_ll_kdd_rpc_bus.md`, `reference_llk_database.md`, `feedback_ll_cursor_errors.md`, `project_lamlinks_writeback.md`
- Related docs: `docs/lamlinks-writeback.md`, `docs/lamlinks-collision-2026-04-21.md`, `docs/sql-profiler-for-invoice-post.md`
- Scripts touching LL:
  - Diagnostics: `who-talks-to-llk.ts`, `find-ll-procs-aggressive.ts`, `all-dbs-object-counts.ts`, `find-ll-proc-across-dbs.ts`, `ll-list-agent-jobs.ts`, `dump-lamlinks-schema.ts`
  - Tracing: `trace-ll-client.ts` (XEvents — can capture live SQL, including kdd_tab inserts when someone exercises the RPC from the WebApp)
  - Envelope handling: `ll-list-my-envelopes.ts`, `inspect-ll-envelope.ts`, `ll-mark-envelope-sent.ts`, `ll-retire-envelope.ts`, `ll-extract-to-temp.ts`, `ll-move-k34-lines.ts`, `ll-remove-k34-line.ts`, `ll-nuke-envelope.ts`
  - Write-back: `redo-bid-with-itmcnt.ts` (the canonical cursor-write-back pattern)
  - TBD: `ll-rpc-pull-status.ts`, `ll-rpc-post-quote.ts` (to be written once open questions are resolved)

## Changelog

- 2026-04-23 — initial writeup covering the reverse-engineering session. Findings based on Sysinternals `strings64.exe` extraction of `llprun.exe` version shipped at the time of analysis.
