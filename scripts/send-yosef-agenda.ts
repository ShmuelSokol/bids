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
<html><head><meta charset="utf-8"><title>DIBS × AX — 1 PM Agenda</title>
<style>
  @page { margin: 0.5in; }
  body { font-family: -apple-system, system-ui, Segoe UI, sans-serif; color: #111; line-height: 1.45; max-width: 720px; margin: 0 auto; padding: 24px; font-size: 13px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #555; margin-bottom: 20px; font-size: 12px; }
  h2 { font-size: 14px; margin: 22px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #111; }
  .card { background: #f6f7f9; border-radius: 8px; padding: 12px 14px; margin: 10px 0; }
  .card h3 { margin: 0 0 4px; font-size: 13px; }
  .muted { color: #666; font-size: 11px; }
  ol, ul { padding-left: 22px; margin: 8px 0; }
  li { margin: 5px 0; }
  .q { margin: 10px 0; padding: 8px 10px; border-left: 3px solid #2563eb; background: #eff6ff; border-radius: 0 4px 4px 0; }
  .q strong { display: block; margin-bottom: 3px; }
  code { background: #e4e4e7; padding: 1px 5px; border-radius: 3px; font-size: 11px; }
  .done { color: #047857; }
  .open { color: #b45309; }
  .topbar { display: flex; justify-content: space-between; align-items: baseline; }
  .meta { color: #666; font-size: 11px; }
</style></head>
<body>

<div class="topbar">
  <h1>DIBS × AX — 1 PM Meeting Agenda</h1>
  <div class="meta">${new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</div>
</div>
<div class="sub">Goal: decide Flow A vs Flow B for PO write-back, and line up the remaining blockers so I can start building this week.</div>

<h2>What's confirmed so far</h2>
<ul>
  <li class="done">OData service principal is <strong>read-only</strong> — write path is DMF spreadsheet + manual import + OData read-back for confirmation</li>
  <li class="done">Legal entity <code>szyh</code>; warehouse <code>W01</code>; ship-to Brooklyn (<code>000000203</code>)</li>
  <li class="done">PO lines DMF template parsed: 7 cols (<code>PURCHASEORDERNUMBER</code>, <code>LINENUMBER</code>, <code>ITEMNUMBER</code>, <code>ORDEREDPURCHASEQUANTITY</code>, <code>PURCHASEPRICE</code>, <code>PURCHASEUNITSYMBOL</code> lowercase, <code>RECEIVINGWAREHOUSEID</code>)</li>
  <li class="done">NPI multi-sheet workbook parsed: RawData, RPCreate (16 cols), RPV2 (5 cols), APPROVEDVENDOR, EXTERNALITEMDESC, BarCode, TradeAgreement</li>
  <li class="done">DMF CAN accept operator-supplied PO numbers — Flow A is viable, not just Flow B</li>
  <li class="done">Downstream: no auto-EDI to vendors after Confirm; transmission stays manual per vendor (portal or email)</li>
  <li class="done">NPI gap acknowledged — items not in AX need product-release import before PO lines can reference them</li>
</ul>

<h2>THE fork — decide first</h2>
<div class="card">
  <h3>Q1 — Flow A or Flow B?</h3>
  <p style="margin:6px 0"><strong>Flow A (fully generated):</strong> DIBS picks a PO number, generates header + lines workbook, you run one DMF import, DIBS polls and confirms.</p>
  <p style="margin:6px 0"><strong>Flow B (manual header, DIBS generates lines):</strong> You create the PO header in AX UI (AX auto-numbers), paste the PO# back into DIBS (or DIBS auto-detects), DIBS generates lines-only sheet, you DMF-import, DIBS polls.</p>
  <p class="muted">A is one fewer manual step per PO but needs: (a) your blessing on DIBS-supplied PO numbers, (b) the headers DMF template, (c) DMF processing header-then-lines correctly in one bundle. B is what you already do for Amazon; adapted for DIBS.</p>
</div>

<h2>If Flow A — follow-ups</h2>
<div class="q"><strong>Q2a — Headers DMF template.</strong> Can you share the headers template (entity/sheet name, columns, a sample row with vendor + payment terms + ship-to)?</div>
<div class="q"><strong>Q2b — PO number pattern.</strong> DIBS's own numeric range to avoid collisions, or a prefix like <code>DIBS-&lt;n&gt;</code> / <code>PO-DIBS-&lt;n&gt;</code>?</div>
<div class="q"><strong>Q2c — Bundle ordering.</strong> When DMF imports a workbook with both header + lines sheets, does it process header first automatically, or do you have to run them as separate DMF jobs?</div>

<h2>If Flow B — follow-up</h2>
<div class="q"><strong>Q3 — Paste-back or auto-detect?</strong> After you create a PO in AX, (a) paste PO# into DIBS manually, or (b) DIBS polls <code>PurchaseOrderHeadersV2</code> for new entries matching vendor + date + line count?</div>

<h2>Applies regardless — need answers</h2>
<div class="q"><strong>Q4 — Sales order template.</strong> Your government-flow SO template + a recent sample unblocks the awards-to-SO generator.</div>
<div class="q"><strong>Q5 — Vendor coverage.</strong> Our vendor codes (AMAZON, 000202, MCMAST, CHEMET, etc., ~34K total) — guaranteed to resolve to real AX <code>VendorAccountNumber</code>s? If not, DIBS pre-flights before you hit Import.</div>
<div class="q"><strong>Q6 — Product group for DIBS items.</strong> NPI sample uses <code>PRODUCTGROUPID = FG-NonRX</code>. Right for DLA / NSN medical items, or should it be <code>FG-MIL</code> / <code>FG-GOV</code>?</div>
<div class="q"><strong>Q7 — <code>EXTERNALITEMDESC</code> 4th column.</strong> Sheet has 3 header labels but every data row has 4 values (4th = barcode). Template bug, or positional?</div>
<div class="q"><strong>Q8 — <code>BarCode</code> sheet NSN vs UPC.</strong> Sample uses <code>UPC</code>. For DLA items should we stamp <code>NSN</code>? Does warehouse receiving handle both the same?</div>
<div class="q"><strong>Q9 — NPI sheet ordering.</strong> Does DMF process the 7 sheets in one Import click in order (RPCreate → RPV2 → APPROVEDVENDOR → EXTERNALITEMDESC → BarCode → TradeAgreement), or one-import-per-sheet?</div>
<div class="q"><strong>Q10 — Polling cadence.</strong> After you click Import, how long until rows show via OData? Seconds, 1 min, 5 min?</div>
<div class="q"><strong>Q11 — Partial-failure reporting.</strong> If DMF rejects some rows, can DIBS read the rejection list via OData, or is that AX DMF Execution Details only?</div>

<h2>Also on the radar (not today, but flag)</h2>
<ul>
  <li>Bid write-back <code>--execute</code> — dry-run SQL from <code>generate-bid-insert-sql.ts</code> waits for your review before we flip the flag on one real bid</li>
  <li>LamLinks invoice chain (<code>ka8 → ka9 → kaj → kad → kae</code>) — I have 7 separate questions for that when you have bandwidth</li>
</ul>

<h2>My reads / recommendations</h2>
<ul>
  <li>Flow A is worth it if the header template is shareable — saves a manual step per PO forever</li>
  <li>Start with Flow B if the header template is painful to dig up — we can upgrade to A later without breaking anything</li>
  <li>For NPI: option (a) — DIBS queues missing items for you to set up, doesn't try to auto-create products — safer while we build trust</li>
  <li>For DIBS-generated PO numbers in Flow A, my vote is a prefix like <code>PO-D-&lt;6 digit&gt;</code> so there's never collision or ambiguity</li>
</ul>

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
    "*DIBS × AX — 1 PM agenda*",
    "",
    "Open the PDF — covers Flow A vs B fork + 11 follow-up questions.",
    "",
    "TL;DR: main decision is whether DIBS supplies PO numbers (Flow A) or you create headers in AX UI and DIBS generates lines only (Flow B).",
  ].join("\n");

  const result = await sendWhatsApp(PHONE, body, pdfUrl);
  if (result) console.log(`\nSent! SID: ${result.sid}, Status: ${result.status}`);
}

main().catch(console.error);
