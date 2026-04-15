/**
 * Build + WhatsApp the 1 PM Yosef meeting agenda as a PDF.
 * Mirrors scripts/send-daily-briefing.ts for HTML → Chrome-headless
 * → Supabase storage → Twilio WhatsApp.
 *
 *   npx tsx scripts/send-yosef-agenda.ts
 *   npx tsx scripts/send-yosef-agenda.ts --no-whatsapp  (preview only)
 */
import "./env";
import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, existsSync } from "fs";

const PHONE = "5162367397";
const SKIP = process.argv.includes("--no-whatsapp");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>DIBS — 1 PM Agenda</title>
<style>
  @page { margin: 0.5in; }
  body { font-family: -apple-system, system-ui, Segoe UI, sans-serif; color: #111; line-height: 1.45; max-width: 720px; margin: 0 auto; padding: 24px; font-size: 13px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #555; margin-bottom: 16px; font-size: 12px; }
  h2 { font-size: 14px; margin: 22px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #111; }
  h2 .tag { font-size: 10px; font-weight: 600; margin-left: 8px; padding: 1px 6px; border-radius: 3px; vertical-align: middle; }
  .tag-ship { background: #dcfce7; color: #065f46; }
  .tag-design { background: #dbeafe; color: #1e3a8a; }
  .card { background: #f6f7f9; border-radius: 8px; padding: 12px 14px; margin: 10px 0; }
  .card h3 { margin: 0 0 4px; font-size: 13px; }
  .muted { color: #666; font-size: 11px; }
  ol, ul { padding-left: 22px; margin: 8px 0; }
  li { margin: 5px 0; }
  .q { margin: 10px 0; padding: 8px 10px; border-left: 3px solid #2563eb; background: #eff6ff; border-radius: 0 4px 4px 0; }
  .q strong { display: block; margin-bottom: 3px; }
  code { background: #e4e4e7; padding: 1px 5px; border-radius: 3px; font-size: 11px; }
  .topbar { display: flex; justify-content: space-between; align-items: baseline; }
  .meta { color: #666; font-size: 11px; }
  .priority { background: #fef3c7; border-left: 3px solid #d97706; padding: 8px 12px; margin: 8px 0; border-radius: 0 4px 4px 0; }
</style></head>
<body>

<div class="topbar">
  <h1>DIBS — 1 PM Meeting Agenda</h1>
  <div class="meta">${new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</div>
</div>
<div class="sub">Three items on the table. (1) and (2) ship <em>today</em> if you can review ~30 min of stuff. (3) is a design fork for next week's build.</div>

<div class="priority">
  <strong>TL;DR — what I actually need from you, ranked:</strong>
  <ol style="margin: 4px 0 0 0">
    <li>Review the bid-write-back SQL (5 min) → we flip <code>--execute</code> on ONE bid today</li>
    <li>Answer the 7 invoice-chain questions (10-15 min) → unblocks phase 2 of that track</li>
    <li>Pick Flow A vs B for PO write-back (15 min + template share) → unblocks the PO-gen build</li>
  </ol>
</div>

<h2>1. Bid write-back to LamLinks<span class="tag tag-ship">READY TO SHIP TODAY</span></h2>
<div class="card">
  <h3>State: 3 quoted bids sitting in <code>bid_decisions</code>, dry-run SQL generated and reviewed on my side</h3>
  <p style="margin: 6px 0">The generator <code>scripts/generate-bid-insert-sql.ts</code> produces INSERT SQL for <code>k33 → k34 → k35</code> in a single transaction. Dry-run mode writes the SQL to a file and <code>ROLLBACK</code>s. <code>--execute</code> runs it for real and flips the bid_decisions rows to <code>status='submitted'</code>.</p>
  <p style="margin: 6px 0"><strong>What I need from you:</strong></p>
  <ul>
    <li>Open <code>C:/tmp/lamlinks-bid-insert-1776228067096.sql</code> (last dry-run output) and eyeball the header + one k34 row + one k35 row</li>
    <li>Tell me if any field looks wrong — especially <code>idpo_k34</code> (I defaulted "1 "), <code>qotref_k33</code> format, <code>a_stat_k33='acknowledged'</code> as the draft state</li>
    <li>If OK, I run with <code>--execute</code> on ONE of the 3 bids. Abe sees it in LamLinks as pending, clicks Submit, normal flow resumes.</li>
  </ul>
  <p class="muted">Schema was reverse-engineered from Abe's 50 most recent successful bids. No stored procs or triggers on k33/k34/k35 — raw INSERT is the only write path. ~45 ERG-specific constants hardcoded.</p>
</div>

<h2>2. LamLinks invoice chain<span class="tag tag-design">7 QUESTIONS, FAST</span></h2>
<div class="card">
  <h3>State: schema fully mapped, <code>cinsta_kad</code> state values known, generator not built yet</h3>
  <p style="margin: 6px 0">Chain: <code>ka8 (Job) → ka9 (Line) → kaj (Shipment) → kad (Invoice) → kae (Invoice Line)</code>. warehouse2 creates ka8/ka9/kaj at fulfillment; ajoseph posts kad/kae at invoice time. DIBS' scope = kad + kae + link back to ka9.</p>
  <p style="margin: 6px 0">States on <code>cinsta_kad</code>: <strong>Posted</strong> (253K), <strong>Not Posted</strong> (44), <strong>Voided</strong> (2). Likely we insert at "Not Posted" then you flip to Posted in the LamLinks UI.</p>
</div>
<div class="q"><strong>Q-inv-1 — "Not Posted" behavior.</strong> Does "Not Posted" show up in the LamLinks UI as a draft you can review, or is it hidden? That's our likely insert state.</div>
<div class="q"><strong>Q-inv-2 — <code>upname_kad='ajoseph'</code>.</strong> Audit field only, or does LamLinks posting logic filter by it? DIBS would use <code>dibs-auto</code> like on bids.</div>
<div class="q"><strong>Q-inv-3 — <code>idnk31_kad=203</code>.</strong> Every sampled invoice has k31 FK = 203. Is that a fixed "ERG DLA Customer" row in k31_tab? Always 203 for DIBS invoices?</div>
<div class="q"><strong>Q-inv-4 — <code>idnk06_kad=1</code>.</strong> What is k06 — company / org / something else?</div>
<div class="q"><strong>Q-inv-5 — Value fields.</strong> <code>pinval_kad / xinval_kad / mslval_kad / nmsval_kad / ppcval_kad / ar_val_kad</code> — sample shows <code>mslval = ar_val</code> and everything else 0. Which is authoritative? Is that pattern typical or sample-biased?</div>
<div class="q"><strong>Q-inv-6 — AX sync path.</strong> Does AX read from kad/kae directly, or via a separate integration? Don't want to write something that breaks the AX-side accounting flow.</div>
<div class="q"><strong>Q-inv-7 — How do YOU post today?</strong> Is the "post" action just <code>UPDATE kad SET cinsta_kad='Posted'</code>, or is there a stored proc / trigger / integration the LamLinks client calls?</div>

<h2>3. AX PO write-back — design fork<span class="tag tag-design">DECIDE, THEN BUILD NEXT WEEK</span></h2>
<div class="card">
  <h3>OData service principal is read-only (you confirmed). Write path = DMF spreadsheet + your Import click + DIBS polls for confirmation.</h3>
  <p style="margin: 6px 0">I parsed your 4-13-26 PO lines + NPI templates — I have the column list for both. Remaining fork:</p>
  <p style="margin: 6px 0"><strong>Flow A (fully generated):</strong> DIBS picks a PO number, generates header + lines workbook, you run one DMF import, DIBS polls and confirms. Needs header template + PO-number pattern buy-in.</p>
  <p style="margin: 6px 0"><strong>Flow B (manual header, DIBS generates lines):</strong> You create header in AX UI (AX auto-numbers), paste PO# back into DIBS (or DIBS auto-detects), DIBS generates lines-only, you DMF-import.</p>
</div>
<div class="q"><strong>Q-ax-1 — Flow A or Flow B?</strong> A is one fewer manual step per PO; B is what you do for Amazon today.</div>
<div class="q"><strong>Q-ax-2 — If Flow A:</strong> Share the PO headers template (entity + columns + sample), PO number pattern (DIBS range? <code>PO-DIBS-&lt;n&gt;</code>?), and whether DMF processes header-then-lines in one bundle correctly.</div>
<div class="q"><strong>Q-ax-3 — If Flow B:</strong> After you create the header in AX, should DIBS prompt you to paste the PO number back in manually (simple box per pending PO), or should DIBS auto-detect by polling <code>PurchaseOrderHeadersV2</code> for new entries matching vendor + date + line count?</div>
<div class="q"><strong>Q-ax-4a — Sales order template.</strong> Your government-flow SO template + a recent imported example. Need the entity/sheet name, column list, and how DD219 + contract # + CLIN get stamped on the sheet.</div>
<div class="q"><strong>Q-ax-4b — SO Flow A or B?</strong> Parallel question to the PO fork. Either DIBS supplies SO# and generates the full workbook, OR you create the SO header in AX UI and DIBS generates lines-only.</div>
<div class="q"><strong>Q-ax-4c — SO grouping.</strong> DIBS default would be one SO per distinct DLA contract number (so multiple awards under the same contract share an SO header). Agree, or is it one-SO-per-award even if they share a contract?</div>
<div class="q"><strong>Q-ax-5 — Vendor coverage.</strong> Our vendor codes (AMAZON, MCMAST, CHEMET, 000202, ~34K total) — all guaranteed to exist as AX <code>VendorAccountNumber</code>s?</div>
<div class="q"><strong>Q-ax-6 — Product group for DIBS items.</strong> NPI sample uses <code>FG-NonRX</code>. Right for DLA/NSN, or different?</div>
<div class="q"><strong>Q-ax-7 — NPI sheet ordering.</strong> Does DMF import the 7 NPI sheets in one click correctly, or separate imports per sheet?</div>
<div class="q"><strong>Q-ax-8 — Polling cadence.</strong> After you Import, how long until rows appear via OData? Seconds? 1 min? 5 min?</div>
<div class="q"><strong>Q-ax-9 — Partial-failure reporting.</strong> When DMF rejects rows, can DIBS read the rejection list via OData, or is it AX UI only?</div>
<div class="q"><strong>Q-ax-10 — <code>BarCode</code> NSN vs UPC.</strong> Sample uses UPC. For DLA items should DIBS stamp NSN? Does warehouse receiving handle both?</div>
<div class="q"><strong>Q-ax-11 — <code>EXTERNALITEMDESC</code> 4th column.</strong> Sheet has 3 headers but rows have 4 values (4th = barcode). Template bug or positional?</div>

<h2>4. End-to-end flow — please scrutinize</h2>
<p style="margin: 6px 0 10px; font-size: 12px;">This is my mental model of the full DIBS pipeline. <strong>Cross out anything wrong</strong> so I'm not building against a false assumption. Numbered steps are the flow; lettered items below each step are the assumptions I'm making that need validation.</p>

<div class="card">
<h3>Stage 1 — Solicitation capture</h3>
<ol>
<li>DIBBS website scraped twice daily (6am + 12pm ET) for open RFQs, stored in <code>dibbs_solicitations</code></li>
<li>LamLinks k10 pulled twice daily (5:30am + 1pm Mon-Fri) for LamLinks-subscribed FSCs</li>
</ol>
<p class="muted"><strong>Assumptions:</strong> (a) DIBBS has every RFQ LamLinks doesn't and vice versa — we take the union. (b) <code>sol_no_k10</code> matches DIBBS solicitation format exactly, so dedup by sol# is reliable. (c) LamLinks only subscribes to ~240 FSCs; DIBBS scrape fills in the other 224 FSCs.</p>
</div>

<div class="card">
<h3>Stage 2 — Enrichment</h3>
<ol>
<li>For each new sol, match NSN against AX first (<code>ProductBarcodesV3</code> where <code>BarcodeSetupId='NSN'</code>), then Master DB as fallback</li>
<li>Pull cost from <code>nsn_costs</code> — rebuilt nightly from AX <code>PurchasePriceAgreements</code> (24K NSNs, 100% with UoM)</li>
<li>Apply pricing waterfall: empirical bracket markup (2.00× / 1.36× / 1.21× / 1.16× by cost bracket), OR winning-history override if we've won this NSN recently</li>
<li>Compute margin, FOB-adjusted margin (if Destination), AI score (0-100)</li>
</ol>
<p class="muted"><strong>Assumptions:</strong> (a) AX is authoritative over Master DB when they disagree on NSN. (b) <code>PurchasePriceAgreements</code> is the RIGHT cost source — it's asking price, not transacted, but recent PO cost path needs a header-join we haven't built yet. (c) Empirical brackets from 466 of Abe's recent bids generalize to future ones. (d) UoM mismatch (award EA vs vendor PG) routes to UNASSIGNED instead of producing bad margin math.</p>
</div>

<div class="card">
<h3>Stage 3 — Bid decision (Abe)</h3>
<ol>
<li>Abe opens <code>/solicitations</code>, filters to sourceable, reviews each row</li>
<li>Quotes at suggested price (or override with comment) → writes <code>bid_decisions</code> row with <code>status='quoted'</code></li>
<li>Batch: select all quoted → "Submit N Bids" → currently just flips to <code>status='submitted'</code> in Supabase and Abe manually copy-pastes to LamLinks</li>
</ol>
<p class="muted"><strong>Assumption:</strong> default bid lead time = 45 days. Can be overridden but never is in practice.</p>
</div>

<div class="card">
<h3>Stage 4 — Bid write-back to LamLinks <em>(pending your review)</em></h3>
<ol>
<li>DIBS generates <code>BEGIN TRANSACTION; INSERT k33 (batch header) + k34 (bid line) × N + k35 (pricing) × N; UPDATE k33 qotref; COMMIT;</code></li>
<li>k33 inserted with <code>a_stat='acknowledged'</code>, <code>o/t/s_stat=NULL</code> — our read of "pending draft, shown in LamLinks UI, not yet transmitted"</li>
<li>Abe sees batch in LamLinks UI, clicks Submit → LamLinks' own app code flips the transmit state and sends EDI to DIBBS</li>
<li>On our side, <code>bid_decisions.status</code> flips <code>quoted → submitted</code> post-COMMIT</li>
</ol>
<p class="muted"><strong>Assumptions:</strong> (a) a_stat='acknowledged' is the right draft state. (b) No triggers or stored procs fire on k33/k34/k35 INSERT (confirmed from sys.triggers + sys.procedures). (c) ~45 hardcoded ERG company constants on k34 (SZY Holdings LLC, 10101 Foster Ave, tax 030538101, etc.) are correct and stable. (d) <code>idpo_k34='1 '</code>, <code>qtek14_k34=3</code> — same values Abe uses on all 50 recent bids. (e) LamLinks UI app code is what transmits; DIBS never touches o/t/s_stat fields.</p>
</div>

<div class="card">
<h3>Stage 5 — Award detection</h3>
<ol>
<li>LamLinks k81 imported nightly into <code>awards</code> table (21,953 rows after dedup fix)</li>
<li>Competitor awards from k81 also captured (kc4_tab → awards with cage ≠ 0AG09, 127K rows)</li>
<li>Match awards back to bid_decisions via (fsc, niin, date) — loose match, no explicit FK</li>
</ol>
<p class="muted"><strong>Assumptions:</strong> (a) k81 has every DLA award we care about. (b) Award date within 90 days of bid date is a safe correlation window. (c) No stale rows in awards — dedup by (contract_number, fsc, niin, cage).</p>
</div>

<div class="card">
<h3>Stage 6 — NPI (conditional — runs ahead of SO/PO if items are new)</h3>
<ol>
<li>DIBS checks every award / PO line item against AX <code>ReleasedProductsV2</code></li>
<li>For any missing item: DIBS generates the NPI multi-sheet workbook (RPCreate + RPV2 + APPROVEDVENDOR + EXTERNALITEMDESC + BarCode + TradeAgreement)</li>
<li>Yosef DMF-imports NPI workbook; DIBS polls until new ItemNumbers resolvable via OData</li>
<li>Only then do Stage 7 (SO) and Stage 8 (PO) proceed — they can't reference an ItemNumber that doesn't exist in AX yet</li>
</ol>
<p class="muted"><strong>Assumptions:</strong> (a) NPI sheets are processed in dependency order on a single DMF import click. (b) <code>PRODUCTGROUPID='FG-NonRX'</code> is correct for DLA/NSN items — or whatever group you specify. (c) Constants per sheet (FIFO-Stock, Warehouse reservation, SiteWHLoc, etc.) are stable across DIBS items. (d) EA is the default for BOM/Inventory/Purchase/Sales UoM on DIBS items.</p>
</div>

<div class="card">
<h3>Stage 7 — Sales order write-back to AX <em>(the customer-side doc; need your template)</em></h3>
<p style="margin:4px 0 8px">Awards = DLA buying from us. The SO is what we owe the government. Runs BEFORE the vendor PO because the SO establishes the customer obligation and the warehouse ka9 line later FKs back to k81 (the award).</p>
<p style="margin:6px 0"><strong>SO Flow A (fully generated):</strong> DIBS picks an SO#, generates header + lines DMF workbook per award batch, you import, DIBS polls <code>SalesOrderHeadersV2</code> via OData.</p>
<p style="margin:6px 0"><strong>SO Flow B (manual header, DIBS generates lines):</strong> You create the SO header in AX UI against DD219 + the contract, paste SO# back into DIBS, DIBS generates lines-only DMF sheet, you import.</p>
<ol style="margin-top: 8px">
<li>Either way, end state: DIBS flips per-award <code>so_state</code> to <code>posted</code> once OData confirms</li>
<li>Header stamps: customer <code>DD219</code>, ship-to per contract (DLA Distribution, New Cumberland PA hardcoded in EDI side), contract number, our CAGE <code>0AG09</code></li>
<li>Lines stamp: NSN, description, qty, unit price (= award unit_price), CLIN if present, required delivery from the award</li>
</ol>
<p class="muted"><strong>Assumptions:</strong> (a) Awards with the same contract_number share an SO header; different contracts → different SO. (b) The government-flow SO template differs materially from the vendor-facing one you had originally, hence needing your specific one. (c) <code>CustomerRequisitionNumber='DD219'</code> on every line (observed on all sampled PO lines; SO side likely same). (d) SO is created BEFORE the PO — warehouse ka9 later references k81 (award) + the invoice side expects the SO to exist. (e) One SO per DIBS "award batch" grouped by contract, not one-per-line.</p>
</div>

<div class="card">
<h3>Stage 8 — PO generation (Supabase only)</h3>
<ol>
<li>Abe opens <code>/orders</code>, filters Awards by date, selects batch, clicks "Generate POs"</li>
<li>DIBS looks up cheapest vendor for each NSN in <code>nsn_costs</code></li>
<li>Groups lines by that winning vendor (NOT by awardee CAGE — awardee is always us, 0AG09)</li>
<li>Lines with UoM mismatch between award and vendor price → UNASSIGNED bucket; Abe uses Switch Supplier to manually reassign</li>
<li>Creates <code>purchase_orders</code> + <code>po_lines</code> rows in Supabase; now exportable as Excel per-supplier or ZIP'd folder of all</li>
</ol>
<p class="muted"><strong>Assumptions:</strong> (a) Vendor codes in <code>nsn_costs.vendor</code> (AMAZON, MCMAST, CHEMET, 000202, etc.) all resolve to real AX <code>VendorAccountNumber</code>s. (b) Award sell price × qty − vendor cost × qty = margin (requires UoM match, enforced). (c) FOB Destination shipping is baked in via the enrichment pricing step.</p>
</div>

<div class="card">
<h3>Stage 9 — AX PO write-back <em>(Q-ax-1 decides approach)</em></h3>
<ol>
<li>PO Flow A: DIBS picks PO#, generates header+lines workbook, Yosef DMF-imports, DIBS polls; OR</li>
<li>PO Flow B: Yosef creates header in AX UI (AX auto-numbers), pastes PO# back to DIBS, DIBS generates lines-only, Yosef DMF-imports, DIBS polls</li>
<li>DIBS polls <code>PurchaseOrderLinesV2</code> via OData until expected line count appears; flips local state <code>drafted → posted</code></li>
<li>After AX Confirm, Yosef manually transmits to vendor (portal/email — no auto-EDI)</li>
</ol>
<p class="muted"><strong>Assumptions:</strong> (a) OData service principal is read-only, confirmed by you. (b) DMF is the only viable write path. (c) DMF accepts operator-supplied PO numbers. (d) One AX PO per Supabase PO, no merging/splitting. (e) Once AX has the PO, AX is source of truth — DIBS doesn't mutate after posting.</p>
</div>

<div class="card">
<h3>Stage 10 — Fulfillment (warehouse, not DIBS)</h3>
<ol>
<li>warehouse2 picks items, creates LamLinks ka8 (job) + ka9 (line) + kaj (shipment)</li>
<li>DIBS reads this via the shipping sync (every 15 min) to show fulfillment state on <code>/shipping</code></li>
</ol>
<p class="muted"><strong>Assumption:</strong> DIBS never writes to ka8/ka9/kaj — warehouse ops own that.</p>
</div>

<div class="card">
<h3>Stage 11 — Invoicing</h3>
<ol>
<li><strong>To DLA (existing):</strong> <code>/invoicing</code> page generates EDI 810 X12, user uploads to Mil-Pac VAN → WAWF</li>
<li><strong>To LamLinks internal (NEW, your 7 questions):</strong> DIBS writes kad + kae rows at <code>cinsta='Not Posted'</code>, UPDATE ka9 to link; you flip to 'Posted' in LamLinks UI</li>
</ol>
<p class="muted"><strong>Assumptions:</strong> (a) DLA customer ship-to is always the hardcoded DLA Distribution, New Cumberland PA — or overridable. (b) "Not Posted" kad rows show up as drafts in your LamLinks UI, same pattern as k33 for bids. (c) k31=203 = "ERG DLA Customer" is constant. (d) k06=1 = company/org code is constant. (e) AX reads kad/kae directly (not via separate integration layer we'd break).</p>
</div>

<div class="card">
<h3>Stage 12 — Remittance</h3>
<ol>
<li>DLA pays ~3x/month via wire</li>
<li>Abe pastes remittance file into <code>/invoicing</code> → parser matches to our invoices</li>
</ol>
<p class="muted"><strong>Known gap:</strong> current matcher uses a hardcoded list of 8 invoice numbers (dev mock); needs real lookup against the invoice history. Not blocking today but flagging.</p>
</div>

<div class="card" style="background: #fef3c7; border-left: 3px solid #d97706;">
<h3>Top 5 things I most want you to X out if wrong</h3>
<ol>
<li><strong>All DIBS customers are DLA.</strong> Every DIBS bid → DD219 customer → W01 Brooklyn ship-to. No non-DLA DIBS flow.</li>
<li><strong>Vendor codes in DIBS all exist in AX.</strong> 34K nsn_vendor_prices rows carry codes like AMAZON, MCMAST — assumed 1-to-1 with AX VendorAccountNumber.</li>
<li><strong>k33.a_stat='acknowledged' + null o/t/s = pending draft in LamLinks UI.</strong> If that's wrong, our bid write-back puts rows into a state Abe can't see or Abe accidentally transmits.</li>
<li><strong>DMF is the only write path.</strong> OData service principal is read-only; no shortcut via a different auth.</li>
<li><strong>No auto-EDI to vendors after AX Confirm.</strong> You confirmed this, but flagging so I don't accidentally rebuild vendor transmission when you'd rather it stay manual.</li>
</ol>
</div>

</body></html>`;

async function sendWhatsApp(phone: string, message: string, mediaUrl?: string) {
  const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    console.error("Twilio env missing");
    return null;
  }
  const to = phone.startsWith("whatsapp:") ? phone : `whatsapp:+1${phone.replace(/\D/g, "")}`;
  const from = TWILIO_WHATSAPP_FROM.startsWith("whatsapp:") ? TWILIO_WHATSAPP_FROM : `whatsapp:${TWILIO_WHATSAPP_FROM}`;
  const params = new URLSearchParams({ To: to, From: from, Body: message });
  if (mediaUrl) params.append("MediaUrl", mediaUrl);
  const resp = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  );
  const result = await resp.json();
  if (!resp.ok) {
    console.error("Twilio error:", result);
    return null;
  }
  return result;
}

async function main() {
  const today = new Date().toISOString().split("T")[0];
  const htmlPath = `C:/tmp/dibs-yosef-agenda-${today}.html`;
  const pdfPath = `C:/tmp/dibs-yosef-agenda-${today}.pdf`;
  writeFileSync(htmlPath, HTML);
  console.log(`HTML: ${htmlPath}`);

  try {
    const chromePath = `"C:/Program Files/Google/Chrome/Application/chrome.exe"`;
    execSync(
      `${chromePath} --headless --disable-gpu --print-to-pdf="${pdfPath}" --no-margins "file:///${htmlPath.replace(/\\/g, "/")}"`,
      { timeout: 15000, stdio: "pipe" }
    );
    console.log(`PDF:  ${pdfPath}`);
  } catch (err: any) {
    console.error("PDF generation failed:", err.message);
    return;
  }

  if (!existsSync(pdfPath)) {
    console.error("No PDF produced");
    return;
  }

  // Upload to Supabase storage (same bucket the briefing uses)
  const pdfBytes = readFileSync(pdfPath);
  const storagePath = `yosef-agenda-${today}.pdf`;
  const { error: upErr } = await supabase.storage
    .from("briefings")
    .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: true });
  if (upErr) {
    console.error("Upload failed:", upErr.message);
    return;
  }
  const { data: pub } = supabase.storage.from("briefings").getPublicUrl(storagePath);
  const pdfUrl = pub.publicUrl;
  console.log(`URL:  ${pdfUrl}`);

  if (SKIP) {
    console.log("\n--no-whatsapp set, done.");
    return;
  }

  const body = [
    "*DIBS — 1 PM agenda*",
    "",
    "Three asks, ranked:",
    "1. Bid write-back — review SQL, flip --execute on ONE bid today",
    "2. Invoice chain — answer 7 questions",
    "3. AX PO — pick Flow A or B, share header/SO templates",
    "",
    "PLUS: final section is the full 12-stage DIBS pipeline with every assumption I'm making. Cross out anything wrong so I'm not building against bad models.",
  ].join("\n");

  const result = await sendWhatsApp(PHONE, body, pdfUrl);
  if (result) console.log(`\nSent! SID: ${result.sid}, Status: ${result.status}`);
}

main().catch(console.error);
