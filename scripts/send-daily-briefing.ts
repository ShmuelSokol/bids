/**
 * Daily Briefing Generator + WhatsApp Sender
 *
 * Usage: npx tsx scripts/send-daily-briefing.ts [--no-whatsapp] [--phone 5162367397]
 *
 * 1. Pulls live stats from Supabase
 * 2. Generates HTML briefing
 * 3. Converts to PDF via Chrome headless
 * 4. Sends summary text + PDF link via WhatsApp (Twilio)
 *
 * Schedule: Windows Task Scheduler or cron, daily at 6:30am ET (after scrape)
 */

import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, existsSync } from "fs";
import path from "path";

// Load env
const envPath = path.join(__dirname, "..", ".env");
if (existsSync(envPath)) {
  const lines = require("fs").readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PHONE = process.argv.includes("--phone")
  ? process.argv[process.argv.indexOf("--phone") + 1]
  : "5162367397";
const SKIP_WHATSAPP = process.argv.includes("--no-whatsapp");
const RAILWAY_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : "http://localhost:3000";

async function getStats() {
  const today = new Date().toISOString().split("T")[0];
  const monthStart = today.slice(0, 7) + "-01";

  // Paginated loader — Supabase caps at 1K rows per request, so we
  // must loop until empty. Hardcoding "N parallel ranges" is how the
  // dashboard/solicitations count mismatch bug keeps coming back.
  async function loadAll<T = any>(
    table: string,
    select: string,
    apply: (q: any) => any = (q) => q,
    hardMax = 20
  ): Promise<T[]> {
    const out: any[] = [];
    for (let p = 0; p < hardMax; p++) {
      const { data, error } = await apply(supabase.from(table).select(select)).range(p * 1000, (p + 1) * 1000 - 1);
      if (error || !data || data.length === 0) break;
      out.push(...data);
      if (data.length < 1000) break;
    }
    return out as T[];
  }

  // Parallel data fetch — all the counts
  const [
    solCount, sourceableCount, openCount, quotedCount, submittedCount,
    todayBids, recentScrapes, pendingJobs, recentAwards, totalAwards,
    nsnVendorPrices, nsnMatches, abeBids, usaspending,
    llChannel, dibbsChannel,
    llSourceable, dibbsSourceable,
    topFscs, recentEnriches,
    syncLogCount, profileCount,
  ] = await Promise.all([
    supabase.from("dibbs_solicitations").select("id", { count: "exact", head: true }),
    supabase.from("dibbs_solicitations").select("id", { count: "exact", head: true }).eq("is_sourceable", true),
    supabase.from("dibbs_solicitations").select("id", { count: "exact", head: true }).gte("return_by_date", today),
    supabase.from("bid_decisions").select("id", { count: "exact", head: true }).eq("status", "quoted"),
    supabase.from("bid_decisions").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("abe_bids_live").select("id", { count: "exact", head: true }),
    // Last 10 scrapes for history
    supabase.from("sync_log").select("created_at,details").eq("action", "scrape").order("created_at", { ascending: false }).limit(10),
    supabase.from("background_jobs").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("awards").select("id", { count: "exact", head: true }).gte("award_date", monthStart),
    supabase.from("awards").select("id", { count: "exact", head: true }),
    // Reference data (only tables that exist)
    supabase.from("nsn_vendor_prices").select("id", { count: "exact", head: true }),
    supabase.from("nsn_matches").select("id", { count: "exact", head: true }),
    supabase.from("abe_bids").select("id", { count: "exact", head: true }),
    supabase.from("usaspending_awards").select("id", { count: "exact", head: true }),
    // Channel breakdown
    supabase.from("dibbs_solicitations").select("id", { count: "exact", head: true }).eq("data_source", "lamlinks"),
    supabase.from("dibbs_solicitations").select("id", { count: "exact", head: true }).eq("data_source", "dibbs_scrape"),
    supabase.from("dibbs_solicitations").select("id", { count: "exact", head: true }).eq("data_source", "lamlinks").eq("is_sourceable", true),
    supabase.from("dibbs_solicitations").select("id", { count: "exact", head: true }).eq("data_source", "dibbs_scrape").eq("is_sourceable", true),
    // Top FSCs
    supabase.from("fsc_heatmap").select("fsc_code,total_bids,bucket").order("total_bids", { ascending: false }).limit(8),
    // Recent enrichments
    supabase.from("sync_log").select("created_at,details").eq("action", "enrich").order("created_at", { ascending: false }).limit(5),
    // Misc
    supabase.from("sync_log").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
  ]);

  // Match dashboard logic: sourceable + open + not already bid + no decision.
  // Use the paginator so we pick up ALL sourceable rows, not the first 3K.
  const SOURCEABLE_COLS =
    "solicitation_number,nsn,suggested_price,quantity,return_by_date,already_bid,already_bid_ll,our_cost,margin_pct,nomenclature,cost_source,is_sourceable";
  const [allSourceable, decisionRes, liveBidsRes] = await Promise.all([
    loadAll("dibbs_solicitations", SOURCEABLE_COLS, (q) => q.eq("is_sourceable", true)),
    supabase.from("bid_decisions").select("solicitation_number,nsn,status"),
    supabase.from("abe_bids_live").select("solicitation_number,nsn,bid_price,bid_qty,bid_time,item_desc,lead_days,bid_status").order("bid_time", { ascending: false }).gte("bid_time", today),
  ]);
  const decisions = decisionRes.data || [];
  const liveBids = liveBidsRes.data || [];

  // Build decision + live bid sets (same as dashboard)
  const decisionMap = new Map<string, string>();
  for (const d of decisions) decisionMap.set(`${d.solicitation_number}_${d.nsn}`, d.status);
  const liveBidSols = new Set(liveBids.map((b: any) => b.solicitation_number?.trim()).filter(Boolean));

  // Open check with MM-DD-YYYY → YYYY-MM-DD conversion (same as dashboard)
  const isOpen = (s: any) => {
    if (!s.return_by_date) return true;
    const parts = s.return_by_date.split("-");
    if (parts.length === 3 && parts[2].length === 4) {
      const isoDate = `${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
      return isoDate >= today;
    }
    return s.return_by_date >= today;
  };

  // Filter exactly like dashboard
  const dashSourceable = allSourceable.filter(
    (s: any) =>
      s.is_sourceable !== false &&
      !s.already_bid &&
      !liveBidSols.has(s.solicitation_number?.trim()) &&
      isOpen(s) &&
      !decisionMap.has(`${s.solicitation_number}_${s.nsn}`)
  );
  const dashQuoted = allSourceable.filter((s: any) => decisionMap.get(`${s.solicitation_number}_${s.nsn}`) === "quoted");
  const dashSubmitted = allSourceable.filter((s: any) => decisionMap.get(`${s.solicitation_number}_${s.nsn}`) === "submitted");

  let pipelineValue = 0;
  let pricedCount = 0;
  for (const r of dashSourceable) {
    if ((r as any).suggested_price > 0) {
      pipelineValue += (r as any).suggested_price * ((r as any).quantity || 1);
      pricedCount++;
    }
  }

  // Top 5 by value for the briefing
  const topByValue = [...dashSourceable]
    .map((s: any) => ({ ...s, potential_value: (s.suggested_price || 0) * (s.quantity || 1) }))
    .filter((s: any) => s.potential_value > 0)
    .sort((a: any, b: any) => b.potential_value - a.potential_value)
    .slice(0, 5);

  // Live bid stats
  const todayBidValue = liveBids.reduce((s: number, b: any) => s + (b.bid_price || 0) * (b.bid_qty || 1), 0);

  // Parse scrape history
  const scrapeHistory = (recentScrapes.data || []).map((s: any) => {
    const d = s.details || {};
    return {
      time: new Date(s.created_at).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
      items: d.count || 0,
      fscs: d.fscs_scraped || 0,
      errors: d.errors?.length || 0,
      elapsed: d.elapsed_seconds || 0,
      remaining: d.fscs_remaining ?? null,
    };
  });

  // Parse enrich history
  const enrichHistory = (recentEnriches.data || []).map((e: any) => {
    const d = e.details || {};
    return {
      time: new Date(e.created_at).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
      sourceable: d.sourceable || 0,
      alreadyBid: d.already_bid || 0,
      withCost: d.with_cost_data || 0,
    };
  });

  const lastScrape = scrapeHistory[0];
  const scrapeItemsToday = scrapeHistory.reduce((s: number, h: any) => s + h.items, 0);
  const scrapeErrorsToday = scrapeHistory.reduce((s: number, h: any) => s + h.errors, 0);

  return {
    // Pipeline (matches dashboard logic)
    totalSolicitations: solCount.count || 0,
    totalSourceableInDb: sourceableCount.count || 0,
    sourceable: dashSourceable.length,        // open + unbid + no decision (matches dashboard)
    quoted: dashQuoted.length,
    submitted: dashSubmitted.length,
    noSource: solCount.count! - (sourceableCount.count || 0),
    pipelineValue,
    pricedCount,
    topByValue,
    // Activity
    abeBidsToday: liveBids.length,
    todayBidValue,
    liveBids: liveBids.slice(0, 10),
    monthlyAwards: recentAwards.count || 0,
    totalAwards: totalAwards.count || 0,
    // Scrape status
    lastScrape,
    scrapeHistory,
    scrapeItemsToday,
    scrapeErrorsToday,
    enrichHistory,
    // Reference data
    nsnVendorPrices: nsnVendorPrices.count || 0,
    nsnMatches: nsnMatches.count || 0,
    abeBidsTotal: abeBids.count || 0,
    usaspending: usaspending.count || 0,
    // Channels
    llChannel: llChannel.count || 0,
    dibbsChannel: dibbsChannel.count || 0,
    llSourceable: llSourceable.count || 0,
    dibbsSourceable: dibbsSourceable.count || 0,
    // Background
    pendingJobs: pendingJobs.count || 0,
    // Top FSCs
    topFscs: (topFscs.data || []).slice(0, 8),
    // System
    syncLogCount: syncLogCount.count || 0,
    profileCount: profileCount.count || 0,
  };
}

function generateHTML(stats: Awaited<ReturnType<typeof getStats>>) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });

  const fscRows = stats.topFscs.map((f: any) => `
    <div class="row"><span class="k">${f.fsc_code} <span style="font-size:10px;color:${f.bucket==='hot'?'#dc2626':f.bucket==='warm'?'#d97706':'#999'}">${f.bucket}</span></span><span class="v">${f.total_bids?.toLocaleString()} bids</span></div>`).join("");

  const scrapeRows = stats.scrapeHistory.map((s: any) => {
    const status = s.errors > 0 ? `<span style="color:#dc2626">${s.errors} errors</span>` : `<span style="color:#16a34a">OK</span>`;
    return `<div class="row"><span class="k">${s.time}</span><span class="v">${s.items} items | ${s.fscs} FSCs | ${status} | ${s.elapsed}s</span></div>`;
  }).join("");

  const enrichRows = stats.enrichHistory.map((e: any) =>
    `<div class="row"><span class="k">${e.time}</span><span class="v">${e.sourceable} sourceable | ${e.alreadyBid} already bid | ${e.withCost} costed</span></div>`
  ).join("");

  const pipelineVal = stats.pipelineValue >= 1000000
    ? `$${(stats.pipelineValue / 1000000).toFixed(2)}M`
    : stats.pipelineValue >= 1000
    ? `$${(stats.pipelineValue / 1000).toFixed(0)}K`
    : `$${stats.pipelineValue.toFixed(0)}`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 720px; margin: 0 auto; padding: 20px; background: #f8f9fa; color: #1a1a2e; font-size: 13px; }
  .header { background: linear-gradient(135deg, #1a1a2e, #16213e); color: white; padding: 24px; border-radius: 12px; margin-bottom: 20px; }
  .header h1 { margin: 0 0 4px; font-size: 22px; }
  .header p { margin: 0; opacity: 0.8; font-size: 13px; }
  .card { background: white; border-radius: 10px; padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .card h2 { margin: 0 0 12px; font-size: 15px; color: #1a1a2e; border-bottom: 2px solid #e8e8e8; padding-bottom: 8px; }
  .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .stat-grid.three { grid-template-columns: 1fr 1fr 1fr; }
  .stat { padding: 10px; border-radius: 8px; background: #f0f4ff; }
  .stat .label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
  .stat .value { font-size: 22px; font-weight: 700; color: #1a1a2e; }
  .stat.green { background: #f0fdf4; } .stat.green .value { color: #16a34a; }
  .stat.blue { background: #eff6ff; } .stat.blue .value { color: #2563eb; }
  .stat.amber { background: #fffbeb; } .stat.amber .value { color: #d97706; }
  .stat.red { background: #fef2f2; } .stat.red .value { color: #dc2626; }
  .stat.purple { background: #faf5ff; } .stat.purple .value { color: #7c3aed; }
  .row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; border-bottom: 1px solid #f0f0f0; }
  .row:last-child { border-bottom: none; }
  .row .k { color: #666; }
  .row .v { font-weight: 600; }
  .alert { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; font-size: 12px; color: #991b1b; }
  .ok { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; font-size: 12px; color: #166534; }
  .footer { text-align: center; font-size: 11px; color: #999; margin-top: 20px; }
</style>
</head>
<body>
  <div class="header">
    <h1>DIBS Daily Briefing</h1>
    <p>${today} &mdash; Ever Ready First Aid (CAGE 0AG09)</p>
  </div>

  ${stats.scrapeErrorsToday > 0 ? `<div class="alert"><strong>DIBBS Scraper:</strong> ${stats.scrapeErrorsToday} fetch errors today across ${stats.scrapeHistory.length} runs. ${stats.scrapeItemsToday} new items found.</div>` : ""}
  ${stats.sourceable > 0 ? `<div class="ok"><strong>${stats.sourceable.toLocaleString()} open sourceable opportunities</strong> worth est. ${pipelineVal} ready for bidding.</div>` : `<div class="alert"><strong>0 open sourceable items.</strong> All items are expired, already bid, or not yet enriched.</div>`}

  <div class="card">
    <h2>Solicitation Pipeline (matches dashboard)</h2>
    <div class="stat-grid">
      <div class="stat green">
        <div class="label">Sourceable</div>
        <div class="value">${stats.sourceable.toLocaleString()}</div>
      </div>
      <div class="stat blue">
        <div class="label">Quoted</div>
        <div class="value">${stats.quoted}</div>
      </div>
      <div class="stat purple">
        <div class="label">Submitted</div>
        <div class="value">${stats.submitted}</div>
      </div>
      <div class="stat amber">
        <div class="label">No Source</div>
        <div class="value">${stats.noSource.toLocaleString()}</div>
      </div>
    </div>
    <div style="margin-top: 10px;">
      <div class="row"><span class="k">Total Open Bid Potential</span><span class="v" style="color:#16a34a;font-size:15px">${pipelineVal}</span></div>
      <div class="row"><span class="k">Items with suggested price</span><span class="v">${stats.pricedCount.toLocaleString()} of ${stats.sourceable.toLocaleString()}</span></div>
      <div class="row"><span class="k">Total solicitations in DB</span><span class="v">${stats.totalSolicitations.toLocaleString()}</span></div>
      <div class="row"><span class="k">Total sourceable in DB (incl expired)</span><span class="v">${stats.totalSourceableInDb.toLocaleString()}</span></div>
    </div>
  </div>

  ${stats.topByValue.length > 0 ? `<div class="card">
    <h2>Top Sourceable — Highest Value</h2>
    <table style="width:100%;font-size:12px;border-collapse:collapse">
      <tr style="border-bottom:1px solid #e8e8e8;color:#666;text-align:left">
        <th style="padding:4px">NSN</th>
        <th style="padding:4px">Item</th>
        <th style="padding:4px;text-align:right">Qty</th>
        <th style="padding:4px;text-align:right">Suggested</th>
        <th style="padding:4px;text-align:right">Value</th>
      </tr>
      ${stats.topByValue.map((s: any) => `<tr style="border-bottom:1px solid #f0f0f0">
        <td style="padding:4px;font-family:monospace;font-size:11px">${s.nsn}</td>
        <td style="padding:4px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.nomenclature || "—"}</td>
        <td style="padding:4px;text-align:right">${s.quantity}</td>
        <td style="padding:4px;text-align:right;color:#16a34a">$${(s.suggested_price || 0).toFixed(2)}</td>
        <td style="padding:4px;text-align:right;font-weight:bold">$${s.potential_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
      </tr>`).join("")}
    </table>
  </div>` : ""}

  ${stats.liveBids.length > 0 ? `<div class="card" style="border:2px solid #bfdbfe;background:#eff6ff">
    <h2 style="color:#1d4ed8">Abe's Bids Today — ${stats.abeBidsToday} bids, $${stats.todayBidValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} value</h2>
    <table style="width:100%;font-size:12px;border-collapse:collapse">
      <tr style="border-bottom:1px solid #bfdbfe;color:#666;text-align:left">
        <th style="padding:4px">Time</th>
        <th style="padding:4px">NSN</th>
        <th style="padding:4px">Item</th>
        <th style="padding:4px;text-align:right">Price</th>
        <th style="padding:4px;text-align:right">Qty</th>
      </tr>
      ${stats.liveBids.map((b: any) => `<tr style="border-bottom:1px solid #dbeafe">
        <td style="padding:3px;font-size:11px;color:#666">${b.bid_time ? new Date(b.bid_time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" }) : "—"}</td>
        <td style="padding:3px;font-family:monospace;font-size:11px">${b.nsn || "—"}</td>
        <td style="padding:3px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px">${b.item_desc || "—"}</td>
        <td style="padding:3px;text-align:right;font-family:monospace">$${(b.bid_price || 0).toFixed(2)}</td>
        <td style="padding:3px;text-align:right">${b.bid_qty || 0}</td>
      </tr>`).join("")}
    </table>
  </div>` : ""}

  <div class="card">
    <h2>Data Channels</h2>
    <div class="row"><span class="k">LamLinks (240 FSCs)</span><span class="v">${stats.llChannel.toLocaleString()} total | ${stats.llSourceable.toLocaleString()} sourceable</span></div>
    <div class="row"><span class="k">DIBBS Scrape (224 FSCs)</span><span class="v">${stats.dibbsChannel.toLocaleString()} total | ${stats.dibbsSourceable.toLocaleString()} sourceable</span></div>
  </div>

  <div class="card">
    <h2>Today's Scrape Activity</h2>
    <div class="row"><span class="k">New items scraped today</span><span class="v">${stats.scrapeItemsToday}</span></div>
    <div class="row"><span class="k">Scrape errors today</span><span class="v" style="color:${stats.scrapeErrorsToday > 0 ? '#dc2626' : '#16a34a'}">${stats.scrapeErrorsToday}</span></div>
  </div>

  <div class="card">
    <h2>Recent Scrape Runs</h2>
    ${scrapeRows || '<div class="row"><span class="k">No scrapes recorded</span></div>'}
  </div>

  <div class="card">
    <h2>Recent Enrichment Runs</h2>
    ${enrichRows || '<div class="row"><span class="k">No enrichments recorded</span></div>'}
  </div>

  <div class="card">
    <h2>Awards & Bid History</h2>
    <div class="stat-grid">
      <div class="stat green">
        <div class="label">Awards This Month</div>
        <div class="value">${stats.monthlyAwards.toLocaleString()}</div>
      </div>
      <div class="stat">
        <div class="label">Total Awards (LL)</div>
        <div class="value">${stats.totalAwards.toLocaleString()}</div>
      </div>
      <div class="stat blue">
        <div class="label">Abe's Bid History</div>
        <div class="value">${stats.abeBidsTotal.toLocaleString()}</div>
      </div>
      <div class="stat amber">
        <div class="label">USASpending</div>
        <div class="value">${stats.usaspending.toLocaleString()}</div>
      </div>
    </div>
  </div>

  <div class="card">
    <h2>Reference Data in Supabase</h2>
    <div class="row"><span class="k">Vendor Prices (supplier switch)</span><span class="v">${stats.nsnVendorPrices.toLocaleString()}</span></div>
    <div class="row"><span class="k">Part Number Matches (PUB LOG)</span><span class="v">${stats.nsnMatches.toLocaleString()}</span></div>
    <div class="row"><span class="k">Sync Log entries</span><span class="v">${stats.syncLogCount.toLocaleString()}</span></div>
    <div class="row"><span class="k">User profiles</span><span class="v">${stats.profileCount}</span></div>
  </div>

  <div class="card">
    <h2>Top FSCs by Bid Volume</h2>
    ${fscRows}
  </div>

  <div class="card">
    <h2>System & Automation</h2>
    <div class="row"><span class="k">Pending background jobs</span><span class="v">${stats.pendingJobs}</span></div>
    <div class="row"><span class="k">DIBBS auto-scrape</span><span class="v">6am + 12pm ET (GitHub Actions)</span></div>
    <div class="row"><span class="k">Job processor</span><span class="v">Every 10 min (GitHub Actions)</span></div>
    <div class="row"><span class="k">Abe bids sync</span><span class="v">Manual (scripts/sync-abe-bids-live.ts)</span></div>
    <div class="row"><span class="k">LamLinks import</span><span class="v">Manual (scripts/import-lamlinks-solicitations.ts)</span></div>
    <div class="row"><span class="k">WhatsApp briefing</span><span class="v">Daily (scripts/send-daily-briefing.ts)</span></div>
  </div>

  <div class="footer">
    Generated by DIBS at ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} ET &mdash; <a href="${RAILWAY_URL}">${RAILWAY_URL.replace("https://", "")}</a>
  </div>
</body>
</html>`;
}

function generateWhatsAppText(stats: Awaited<ReturnType<typeof getStats>>) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  });

  const pipelineVal = stats.pipelineValue >= 1000000
    ? `$${(stats.pipelineValue / 1000000).toFixed(2)}M`
    : stats.pipelineValue >= 1000
    ? `$${(stats.pipelineValue / 1000).toFixed(0)}K`
    : `$${stats.pipelineValue.toFixed(0)}`;

  const lines = [
    `*DIBS Daily Briefing* - ${today}`,
    ``,
    `*Dashboard Pipeline*`,
    `Sourceable: ${stats.sourceable} | Quoted: ${stats.quoted} | Submitted: ${stats.submitted}`,
    `No Source: ${stats.noSource.toLocaleString()} | Total: ${stats.totalSolicitations.toLocaleString()}`,
    `*Open Bid Potential: ${pipelineVal}*`,
  ];

  if (stats.abeBidsToday > 0) {
    lines.push(``, `*Abe's Bids Today: ${stats.abeBidsToday}* ($${stats.todayBidValue.toLocaleString(undefined, { maximumFractionDigits: 0 })})`);
  }

  lines.push(
    ``,
    `*Scraper*`,
    `${stats.scrapeItemsToday} new items | ${stats.scrapeErrorsToday} errors`,
    ``,
    `*Awards*`,
    `Month: ${stats.monthlyAwards.toLocaleString()} | Total: ${stats.totalAwards.toLocaleString()}`,
    ``,
    `*Data*`,
    `LL: ${stats.llChannel.toLocaleString()} | DIBBS: ${stats.dibbsChannel.toLocaleString()}`,
    `${stats.nsnVendorPrices.toLocaleString()} vendor prices | ${stats.nsnMatches.toLocaleString()} P/N matches`,
    ``,
    `PDF attached with full details`,
    `${RAILWAY_URL}`,
  );

  return lines.join("\n");
}

async function sendWhatsApp(to: string, message: string, mediaUrl?: string) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM } = process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    console.log("Twilio not configured — skipping WhatsApp send");
    console.log("Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM in .env");
    return null;
  }

  const toNumber = to.replace(/[^0-9+]/g, "");
  const whatsappTo = `whatsapp:${toNumber.startsWith("+") ? toNumber : `+1${toNumber}`}`;
  const whatsappFrom = TWILIO_WHATSAPP_FROM.startsWith("whatsapp:")
    ? TWILIO_WHATSAPP_FROM
    : `whatsapp:${TWILIO_WHATSAPP_FROM}`;

  const params = new URLSearchParams({
    To: whatsappTo,
    From: whatsappFrom,
    Body: message,
  });
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
  console.log("Fetching stats from Supabase...");
  const stats = await getStats();

  console.log("\nStats:", JSON.stringify(stats, null, 2));

  // Generate HTML
  const html = generateHTML(stats);
  const today = new Date().toISOString().split("T")[0];
  const htmlPath = `C:/tmp/dibs-briefing-${today}.html`;
  const pdfPath = `C:/tmp/dibs-briefing-${today}.pdf`;
  writeFileSync(htmlPath, html);
  console.log(`\nHTML saved: ${htmlPath}`);

  // Convert to PDF
  try {
    const chromePath = `"C:/Program Files/Google/Chrome/Application/chrome.exe"`;
    execSync(
      `${chromePath} --headless --disable-gpu --print-to-pdf="${pdfPath}" --no-margins "file:///${htmlPath.replace(/\\/g, "/")}"`,
      { timeout: 15000, stdio: "pipe" }
    );
    console.log(`PDF saved: ${pdfPath}`);
  } catch (err: any) {
    console.error("PDF generation failed:", err.message);
  }

  // Upload PDF to Supabase Storage for public URL
  let pdfUrl: string | undefined;
  if (existsSync(pdfPath)) {
    try {
      const pdfBuffer = readFileSync(pdfPath);
      const fileName = `dibs-briefing-${today}.pdf`;

      // Ensure bucket exists
      await supabase.storage.createBucket("briefings", { public: true }).catch(() => {});

      await supabase.storage.from("briefings").upload(fileName, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

      const { data: urlData } = supabase.storage.from("briefings").getPublicUrl(fileName);
      pdfUrl = urlData.publicUrl;
      console.log(`PDF uploaded: ${pdfUrl}`);
    } catch (err: any) {
      console.error("PDF upload failed:", err.message);
    }
  }

  // Send WhatsApp
  if (SKIP_WHATSAPP) {
    console.log("\n--no-whatsapp flag set, skipping WhatsApp send");
    console.log("\nWhatsApp message preview:");
    console.log(generateWhatsAppText(stats));
    return;
  }

  console.log(`\nSending WhatsApp to ${PHONE}...`);
  const text = generateWhatsAppText(stats);

  // Send text + PDF as media
  const result = await sendWhatsApp(PHONE, text, pdfUrl);

  if (result) {
    console.log(`Sent! SID: ${result.sid}, Status: ${result.status}`);
  } else {
    console.log("WhatsApp send failed or not configured");
    console.log("\nMessage that would have been sent:");
    console.log(text);
  }
}

main().catch(console.error);
