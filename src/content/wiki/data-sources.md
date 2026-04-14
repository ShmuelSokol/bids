# Data Sources

DIBS is mostly glue between five external systems. This page is a field guide to each — what's in them, how we read them, and what made them painful.

## 1. LamLinks SQL Server

**What it is:** The third-party bid-management system Abe uses. It has its own SQL Server database (`llk_db1`) running on `NYEVRVSQL001`. Windows Authentication only, so you can only connect from a machine on the ERG domain.

**What we pull out of it:**

- **Solicitations** from 240 FSCs that LamLinks subscribes to (~12K items). Import via `scripts/import-lamlinks-solicitations.ts`.
- **Awards history** — every award LamLinks has seen (~74K rows). Import via `scripts/import-lamlinks-awards.ts`. This is the single most important dataset we have for pricing — knowing what winning bids looked like historically is worth more than any theoretical markup model.
- **Abe's bids** — both historical (`abe_bids`, 10K rows) and today's live (`abe_bids_live`, synced each morning via `scripts/sync-abe-bids-live.ts`).
- **Item specs + win/loss** from `k08_tab` via `scripts/sync-item-specs.ts`.

### The tables we care about

| Table | What it holds |
|-------|---------------|
| `k10_tab` | Solicitations (master header). `sol_no_k10` matches DIBBS format exactly. |
| `k11_tab` | Solicitation line items. |
| `k08_tab` | Item master. NSN, description, mfr part number. |
| `k34_tab` | Bid line items (76 columns). `stat_k34` = blank (draft), S (submitted). |
| `k33_tab` | Bid batch header. `batch_k33` FK from k34. |
| `k35_tab` | Bid pricing/delivery. |
| `k81_tab` | Awards. |
| `ka8_tab → ka9_tab → kaj_tab → kad_tab → kae_tab` | Job → line → shipment → invoice → invoice line. The invoicing chain. |

**Why we don't write to it:** Everything above is read-only until Yosef signs off. The k33/k34/k35 chain and the ka8→kae invoicing chain both have triggers and stored procedures we haven't fully audited. Writing a malformed row into a 500-orders/week production system is how you lose a week and a lot of trust.

### How to query it

```bash
# One-off query (local only — requires msnodesqlv8 installed via --no-save)
cd scripts
npx tsx llk-query.ts "SELECT TOP 5 sol_no_k10, isdt_k10 FROM k10_tab"
```

The helper is `scripts/llk-query.ts`. It handles the Windows Auth connection string and pretty-prints results.

## 2. D365 / AX

**What it is:** The ERP where Ever Ready actually lives. Customers, vendors, purchase orders, price agreements, sales history.

**Auth:** OAuth2 client credentials. Tenant `d5a49985-5534-44ad-8ced-67ee0203bfce`, client ID `62993f8e-1b7e-473f-b4b9-aa9964ddee5c`. Credentials are in `.env` and Railway.

**Base URL:** `https://szy-prod.operations.dynamics.com` (direct) or `https://yosefapptest.azure-api.net/d365` (APIM proxy, which is what we use for higher rate limits).

### The entities that matter

| OData entity | Row count | What it has |
|--------------|-----------|-------------|
| `ProductBarcodesV3` | 55,845 | The golden NSN table. 24,861 NSN barcodes, 30,955 UPC barcodes, 29 HS codes. This is how we know whether we can source an item. |
| `VendorProductDescriptionsV2` | 152,000 | Vendor → item → description mappings. Useful for P/N matching. |
| `PurchaseOrderLinesV2` | 61,000 | Historical PO lines. Gives us actual recent purchase costs. |
| `PurchasePriceAgreements` | 134,000 | Current vendor pricing agreements. Cheapest vendor per NSN. |

**The government customer account is `DD219`.** Every gov sale/invoice must be filtered by this account number. Queries that forget this filter will return enormous result sets.

### How NSN matching works

For a solicitation with NSN `6515-01-676-3176`:

1. Query `ProductBarcodesV3` for records where `BarcodeNumber = "6515016763176"` (no dashes). If found → we have AX coverage → `is_sourceable: true`.
2. If not found, check the Master DB (next section).
3. If still not found, try P/N matching (PUB LOG section).

The bulk import is handled by `scripts/sync-ax-barcodes.ts` which pulls the whole `ProductBarcodesV3` table into the Supabase `nsn_catalog` table. We don't hit AX on every page load — that would be far too slow.

## 3. Master DB

**What it is:** An internal FastAPI service at `masterdb.everreadygroup.com`. 405K item records, 192K with mfr part numbers, ~657 verified NSNs. This is ERG's cross-SKU master, not specific to gov.

**Auth:** `X-Api-Key` header. Key in `.env` as `MASTERDB_API_KEY`.

### Key endpoints

- `GET /api/dibs/items/export?has_mfr=1` — bulk item export, filtered.
- `GET /api/dibs/items/export?has_nsn=1` — items with any NSN.
- `POST /api/dibs/nsn` — write back a newly verified NSN.

The Master DB is a **secondary** source. We check AX first. If AX doesn't have it but Master DB does, we still mark the item sourceable. The pricing logic treats Master DB costs with slightly lower confidence because the cost data isn't as fresh.

## 4. DIBBS (Defense Internet Bid Board System)

**What it is:** The official DLA procurement portal at `www.dibbs.bsm.dla.mil`. This is where solicitations are *actually* posted by the government. LamLinks is a scraper wrapper around this.

**No login needed** for browsing — just a consent banner. But the consent flow is genuinely painful. See [Gotchas](/wiki/gotchas#the-dibbs-consent-saga) for the full story.

### What we scrape

- Search by FSC: `/Rfq/RfqRecs.aspx?category=FSC&value={fsc}&scope={today|open|recent}`.
- Pagination: ASP.NET `__doPostBack` with max 500 results per FSC across 10 pages of 50.
- We scrape the 224 FSCs that LamLinks *doesn't* cover — this is the whole reason we have DIBBS direct scraping. Without it we'd be blind to half the market.

### How the scraper runs

- **GitHub Actions cron** at 6am + 12pm ET hits the Railway API at `/api/dibbs/scrape-now`.
- The scrape endpoint handles **30 FSCs per batch** in parallel groups of 5.
- A full pass takes ~8 batches to cover all 217 expansion FSCs.
- Each new row goes straight into `dibbs_solicitations` and immediately triggers enrichment (NSN match + pricing).

### DIBBS quirks we care about

- **Solicitation numbers** always start with `SPE` followed by a 3-letter center code and a numeric/alpha tail (e.g., `SPE2DS-26-T-7787`).
- **Dates** come back as `MM-DD-YYYY`, not ISO. Every date comparison has to account for this (see [Gotchas](/wiki/gotchas#the-timezone-bug-that-wasted-a-day)).
- **Set-aside badges** appear as column values `SDVOSB`, `WOSB`, `8(a)`, etc. We ignore blank/`no`/`none`/`N/A` values.
- **FOB** is `Destination` or `Origin`, which changes how we compute effective margin.

## 5. PUB LOG (Defense Logistics Agency)

**What it is:** The DLA's master catalog of every NIIN (National Item Identification Number) in the federal supply system. 16.9 million rows in `FLIS_IDENTIFICATION`, 5.6M in `FLIS_MANAGEMENT`, 7.2M in `FLIS_PART`.

**How we got it:** The DLA distributes PUB LOG as a DVD/ISO. We exported it using `IMD2.EXE` (their batch export tool) into CSV files, then imported to Supabase via `scripts/import-publog-csv.ts`. This was a one-time crawl and we re-run it quarterly when DLA ships an update.

**Why it matters:** For items where our NSN doesn't match AX or Master DB, PUB LOG gives us the *part numbers* associated with each NIIN. We then cross-reference those part numbers against our k08 LamLinks table and our Master DB to find items we *can* source under a different part number.

The matching script is `scripts/find-nsn-matches.ts`. Current hit rate:

- **5,603 exact P/N matches** against LamLinks k08
- **3,232 title similarity matches** (fuzzy, lower confidence)
- **34 Master DB matches**
- **Total: 7,521 new match rows** in the `nsn_matches` table

Every matched item gets a `HIGH`/`MEDIUM`/`LOW` confidence tag. The solicitations UI shows a "Strong Match" or "Medium Match" badge next to the NSN when `nsn_matches` has a row.

## What we don't have yet

- **Full PUB LOG item names** — we still need to re-export with the H6 segment checked.
- **CAGE directory** — the `cage_directory` table is empty. We need to re-export PUB LOG with the CAGE segment checked, which gives us a CAGE → company name lookup. Without it, all our "competitor" data shows just a CAGE code, not who that CAGE belongs to.
- **USPS/SAM.gov** — `usaspending_awards` has 10K rows from the USASpending API. We don't yet query SAM.gov Opportunities directly — we rely on DIBBS for that.
- **FED LOG** — haven't pulled it yet. Would give us more NSN metadata.

## The Supabase tables these feed

To tie it all together — here's what ends up in Supabase from each source:

| Source | Supabase tables it writes to |
|--------|------------------------------|
| DIBBS (scrape) | `dibbs_solicitations` |
| LamLinks | `dibbs_solicitations` (bulk import), `awards`, `abe_bids`, `abe_bids_live` |
| AX / D365 | `nsn_catalog`, `nsn_vendor_prices`, `nsn_costs` |
| Master DB | Supplements `nsn_costs`, `nsn_matches` |
| PUB LOG | `nsn_matches` (via the match script) |
| USASpending | `usaspending_awards` |

The whole point is that by the time a solicitation shows up on the dashboard, it's been enriched from all of these. No live lookups, no slow page loads.
