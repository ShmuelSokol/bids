# LamLinks feature inventory — what DIBS can absorb

Derived from the `Page.Caption` / `Option.Caption` / `Menu.Caption` literal strings in `llprun.exe` (see `docs/lamlinks-reverse-engineering.md` for methodology). This is LL's complete UI surface — every tab, every screen, every major workflow the desktop app exposes.

The goal is for DIBS to offer *everything* LL does and more, with modern UX. This doc is the roadmap.

## Column legend

- **Status**: `built` = DIBS has it / `partial` = some coverage / `missing` = nothing in DIBS yet
- **Path**: `db-read` = fully buildable from reading llk_db1 (no API auth needed) / `api` = needs REST API (requires api_key we haven't found yet) / `ui-only` = UI construct only, no new backend needed
- **Priority**: `P0` = Abe uses daily, biggest leverage / `P1` = weekly / `P2` = occasional / `P3` = nice-to-have

## Status: Tables we can read from llk_db1 right now

Every item below is reachable through our existing `scripts/llk-query.ts` helper + mssql access. No LL-vendor dependency.

### P0 — Abe's daily time leaks

| Feature | LL screen | DIBS today | Path | Tables |
|---|---|---|---|---|
| **Shipment + POD tracker** | "Page5 Material", "Page8 Quote" | missing | db-read | k89_tab (POD), kaj_tab (shipments), k81_tab (ship qty) |
| **Customer invoice status** | Pg Invoices | missing | db-read | kad_tab (`cinsta`: Not Posted/Posted/Voided) |
| **Supplier invoice status** | Pg A/P | missing | db-read | ka1_tab (`sinsta`) |
| **WAWF EDI tracker (810/856/857)** | "Transmit" page | missing | db-read | kbr_tab (`xtcsta` with all 16 WAWF/SAMMS scenarios) |
| **Ack log for every quote** | "Acknowledgment Log" option | partial (we see award results only) | db-read | kdb_tab (quote transmit log), k33.a_stat_k33 |
| **RFQ Quotes viewer** | "RFQ Quotes" tab in Part form | missing | db-read | k34_tab + k35_tab (our quote lines + prices) |

### P0 — Core sourcing/bidding enhancements

| Feature | LL screen | DIBS today | Path | Tables |
|---|---|---|---|---|
| **Full solicitation detail** | 14-page Part form (Files/Summary/Details/Internet/Viewer/RFQs/Prices/Quote/Reports/Jobs/Material/Documents/Tech/Debug) | we show ~20 fields | db-read | k10_tab + k11_tab + k08_tab + kc4_tab |
| **Procurement History per NSN** | Pg2 Procurement History | partial (usaspending_awards, ~10K rows) | db-read | kc4_tab (awards) + k10/k11 join — LL has years of data |
| **DLA destinations analytics** | "Solicitation Deliveries" option | we show addresses only | db-read | k81_tab ship-to fields |
| **Part Number variants** | Pg "P/Ns" | partial (single p/n) | db-read | k15_tab (P/Ns per NSN, multi-CAGE) |
| **NSN Technical Characteristics** | Pg "Tech" | missing (PUBLOG-lite only) | db-read | Technical chars from DIBBS scraping exists in LL DB |
| **PID (Procurement Item Description)** | Dble-Click toggle on sol detail | missing | db-read | kah_tab.anutyp='Procurement Item Description' (170K rows!) |
| **Contract Packaging Requirements** | Sol detail | missing | db-read | kah_tab.anutyp='Contract Packaging Requirements' (114K rows!) |
| **Packaging Notes** | Sol detail | missing | db-read | kah_tab.anutyp='Packaging Notes' |

### P1 — PO / AR / AP operations

| Feature | LL screen | DIBS today | Path | Tables |
|---|---|---|---|---|
| **Customer Invoice creation/posting** | Invoice form | partial (we generate POs) | db-read + eventually writes | kad_tab + kae_tab lines |
| **Customer PO viewer** | "POs" tab | partial (we generate) | db-read | k89_tab (received POs) |
| **Supplier PO lifecycle** | PO form | partial (we generate draft) | db-read | our purchase_orders + LL's side |
| **Receipts / receiving log** | Pg "Receipts" | missing | db-read | kbw_tab (receipts: Adding/Posted) |
| **Inspection records** | Pg "Inspection" | missing | db-read | k93_tab (`instat`: Pending/Accepted/Rejected/Automatic) |
| **Payment terms master** | Setup "Terms" pages | missing | db-read | br8_tab |
| **Check register / A/P writer** | "Checks" form | missing | db-read | kbn_tab (checks out), kbm_tab (batch control) |

### P1 — Inventory & materials

| Feature | LL screen | DIBS today | Path | Tables |
|---|---|---|---|---|
| **Current Inventory Only** filter | k93 option | missing | db-read | k93_tab (`isttbl` routing) + kbb_tab (batches) |
| **Material requirements** | "Material" tab | missing | db-read | k85_tab + kaa_tab reserves |
| **BOM (Bill of Materials)** | "BOM" tab | missing | db-read | BOM tables (chain via kc4 → k90) |
| **Pick tickets** | pktsta_kbt flow | missing | db-read | kbt_tab (pick tickets) + kbu_tab (lines) |
| **MRB (Material Review Board)** | "mrbsta" | missing | db-read | kbj_tab |
| **Certification (material certs)** | crtsta tracking | missing | db-read | kbh_tab |

### P2 — Reporting & admin

| Feature | LL screen | DIBS today | Path | Tables |
|---|---|---|---|---|
| **Production Designer (reports)** | "Design Report" caption | missing (UI-only needed) | ui-only | — custom report builder |
| **System Logs + Alerts + FYI files** | Page1–3 of admin form | missing | db-read | sys_log tables + d02/d03 for jobs |
| **CAGE master (all entities)** | "Organization Query" page | missing | db-read | k12_tab (entities) + k13_tab (CAGE per entity) |
| **User management** | "Login" setup page | built (our own users, separate) | ui-only | k14_tab (LL users — read-only mirror) |
| **Job queue / batch status** | Pg "Jobs" + "Job Status" | missing | db-read | d03_tab + d02_tab (job workers) |
| **Priority management** | Pg "Priorities" | missing | db-read | priority table + color coding |

### P2 — Auto-acquisition features

| Feature | LL screen | DIBS today | Path | Tables |
|---|---|---|---|---|
| **PDMI (cFolders) document download** | "Internet" tab, PDMI form | partial (we scrape drawings ad-hoc) | db-read + http | URL template in strings: pcf1x.bsm.dla.mil/cfolders/fol_de.htm?p_sol_no=X; LL logs creds into PDMI via saved credentials |
| **TDP (Technical Data Package) management** | "Drawings" tab | missing | db-read | kal_tab (TDP files), filnam_k17 linked files |
| **Document query/viewer** | Pg "Documents" | partial (files grid) | db-read | c79_tab (all files), k17_tab (archived) |

## Status: Features that need the REST API (blocked on api_key discovery)

| Feature | LL screen | Why API | Function |
|---|---|---|---|
| **Submit a quote to DLA** | Put client quote | The cursor-write approach conflicts; REST is the clean path | `put_client_quote` |
| **Award verification pull** | LL's auto-pull of awards | Incremental via `datetime_of_last_change` | `get_awards_by_contract_url`, `VSE Solicitation Status` |
| **Entity info lookup** | Query a CAGE globally | Cross-customer data | `e_code_to_entity_info` |
| **New e-commerce partner** | Add supplier to LL | Triggers LL's supplier onboarding flow | `new_ecommerce_partner`, `add_ecommerce_partner` |
| **DIBBS credentials update** | Change DIBBS password LL uses | LLSM C# service runs this | `update_dibbs_password` |
| **Heartbeat** | Any page | Sanity check | `are_you_listening` |
| **PDF text extraction** | auto-PDFs | LLSM C# service | `PDF_TO_TEXT` |
| **PDF flatten** | TDP processing | LLSM C# service | `FLATTEN_PDF` |

All of these are unblocked the moment Yosef or Abe shares `api_key` + `api_secret` from their workstation's `LLPro.ini`.

## UX improvements LL doesn't do well (where DIBS can be "better than")

LL is functional but 2000s-era: tiny green-on-black fields, modal-heavy workflows, no search as you type, no batch mobile access, no dashboards, limited filtering.

### Concrete opportunities DIBS should own

1. **One-click "what's happening right now" dashboard** — a single page showing: un-acked quotes, sent-but-not-received POs, WAWF rejects, PODs waiting, invoices due, inspection holds. LL makes you navigate 8 different screens for this.
2. **Mobile-first shipment tracker** — Abe checks carrier tracking from his phone; we can pull POD status + show BOL + tracking# in 2 taps.
3. **Supplier relationship scorecards** — on-time %, price trend, margin contribution, WAWF ack rate. LL has the data, no UI for it.
4. **Automatic margin alerts** — notification when a quoted bid drifts into loss territory (cost updates, vendor change).
5. **Solicitation PID search** — we can grep kah_tab's 170K `Procurement Item Description` rows via PostgreSQL FTS. LL can't (FoxPro + memo fields = table scans only).
6. **Timeline view** for any solicitation — sol posted → we quoted → DLA awarded (or lost) → PO cut → shipped → invoiced → paid. Cradle to grave on one page.
7. **Award-at-a-glance for any CAGE** — pivot: given a vendor CAGE, show all their awards against us, win rate, pricing trend.

## Integration prerequisites (what blocks each tier)

### Tier 0 — Available today (DB read only)
Everything marked `db-read` above. Needs: mssql/msnodesqlv8 (installed) + NYEVRVSQL001 reachable (yes). **Can start immediately.**

### Tier 1 — REST API read
Requires api_key + api_secret + sally_login. Sally_login is in llk_db1. The api_key is in `C:\LamlinkP\LLPro.ini` on each workstation (or a related secure file). Yosef's or Abe's machine has it. **5-minute blocker.**

### Tier 2 — REST API write (quote submission)
Same as Tier 1 — once read works, write is the same endpoint with a different function name.

### Tier 3 — Live sync
Build a background worker that polls incrementally using `VSE Solicitation Status` handler with `datetime_of_last_change` cursor. Replaces DIBBS scraping for DLA-known data.

## How to extend this inventory

Whenever you find a `Page.Caption = "..."` or `Option.Caption = "..."` string in `rev-eng/strings/llprun-strings.txt` that's not in this table, add it. The existing `docs/lamlinks-schema/` dump lists every table — any table not mentioned here is either LL internals we don't need, or something we haven't recognized yet.
