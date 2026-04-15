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
<div class="q"><strong>Q-ax-3 — Sales order template.</strong> Need your government-flow SO template + a recent sample to build the awards → SO generator.</div>
<div class="q"><strong>Q-ax-4 — Vendor coverage.</strong> Our vendor codes (AMAZON, MCMAST, CHEMET, 000202, ~34K total) — all guaranteed to exist as AX <code>VendorAccountNumber</code>s?</div>
<div class="q"><strong>Q-ax-5 — Product group for DIBS items.</strong> NPI sample uses <code>FG-NonRX</code>. Right for DLA/NSN, or different?</div>
<div class="q"><strong>Q-ax-6 — NPI sheet ordering.</strong> Does DMF import the 7 NPI sheets in one click correctly, or separate imports per sheet?</div>
<div class="q"><strong>Q-ax-7 — Polling cadence.</strong> After you Import, how long until rows appear via OData? Seconds? 1 min? 5 min?</div>
<div class="q"><strong>Q-ax-8 — Partial-failure reporting.</strong> When DMF rejects rows, can DIBS read the rejection list via OData, or is it AX UI only?</div>
<div class="q"><strong>Q-ax-9 — <code>BarCode</code> NSN vs UPC.</strong> Sample uses UPC. For DLA items should DIBS stamp NSN? Does warehouse receiving handle both?</div>
<div class="q"><strong>Q-ax-10 — <code>EXTERNALITEMDESC</code> 4th column.</strong> Sheet has 3 headers but rows have 4 values (4th = barcode). Template bug or positional?</div>

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
    "*DIBS — 1 PM agenda (revised)*",
    "",
    "Three items, ranked:",
    "1. Bid write-back — review SQL, flip --execute on ONE bid today (5 min)",
    "2. Invoice chain — answer 7 questions (10-15 min) to unblock build",
    "3. AX PO write-back — pick Flow A or B + share header/SO templates",
    "",
    "PDF has the details.",
  ].join("\n");

  const result = await sendWhatsApp(PHONE, body, pdfUrl);
  if (result) console.log(`\nSent! SID: ${result.sid}, Status: ${result.status}`);
}

main().catch(console.error);
