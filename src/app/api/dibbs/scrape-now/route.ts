import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * POST /api/dibbs/scrape-now
 * Triggers a DIBBS scrape for today's solicitations.
 * In production, this would spawn a background worker.
 * For now, it does a lightweight scrape of key FSCs via fetch
 * (no Playwright needed — we can parse the HTML server-side).
 */

const DIBBS_BASE = "https://www.dibbs.bsm.dla.mil";
// FSCs loaded dynamically from fsc_expansion table, minus LamLinks-covered ones

interface RawSolicitation {
  nsn: string;
  nomenclature: string;
  solicitation_number: string;
  quantity: number;
  issue_date: string;
  return_by_date: string;
  fsc: string;
  set_aside: string;
}

function parseTable(html: string, fsc: string): RawSolicitation[] {
  const results: RawSolicitation[] = [];
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  while ((match = rowPattern.exec(html)) !== null) {
    const row = match[1];
    if (!row.includes("SPE2D") && !row.includes("SPM")) continue;
    const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let cm;
    while ((cm = cellPattern.exec(row)) !== null) {
      cells.push(cm[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim());
    }
    if (cells.length >= 8) {
      const solMatch = cells[4]?.match(/(SPE\S+|SPM\S+)/);
      const qtyMatch = cells[6]?.match(/QTY:\s*(\d+)/);
      results.push({
        nsn: cells[1]?.trim() || "",
        nomenclature: cells[2]?.trim() || "",
        solicitation_number: solMatch ? solMatch[1] : "",
        quantity: qtyMatch ? parseInt(qtyMatch[1]) : 0,
        issue_date: cells[7]?.trim() || "",
        return_by_date: cells[8]?.trim() || "",
        fsc,
        set_aside: cells[3]?.trim() || "None",
      });
    }
  }
  return results;
}

export async function POST() {
  const startTime = Date.now();
  const allSolicitations: RawSolicitation[] = [];
  const errors: string[] = [];

  // Load all expansion FSCs from Supabase
  const supabaseCheck = createServiceClient();
  let allExpansionFscs: string[] = [];
  let llFscs: string[] = [];

  try {
    // Get all FSCs from expansion table
    const { data: expRows } = await supabaseCheck
      .from("fsc_expansion")
      .select("fsc_code")
      .limit(500);
    allExpansionFscs = (expRows || []).map((r: any) => r.fsc_code).filter(Boolean);
  } catch {}

  try {
    // Get LamLinks-covered FSCs
    const { data: lastImport } = await supabaseCheck
      .from("sync_log")
      .select("details")
      .eq("action", "lamlinks_import")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (lastImport?.details?.active_fscs) {
      llFscs = lastImport.details.active_fscs;
    }
  } catch {}

  // Only scrape FSCs NOT already covered by LamLinks
  const llSet = new Set(llFscs);
  const fscsToScrape = allExpansionFscs.filter(fsc => !llSet.has(fsc));
  const skippedFscs = allExpansionFscs.filter(fsc => llSet.has(fsc));

  // Limit per call to avoid Railway timeout (30s).
  // Scrape 30 FSCs per call — UI can call multiple times, or cron handles all.
  const BATCH_SIZE = 30;

  // Track which FSCs were already scraped today so we don't re-scrape
  let alreadyScrapedToday: string[] = [];
  try {
    const todayStart = new Date(new Date().toDateString()).toISOString();
    const { data: todayLog } = await supabaseCheck
      .from("sync_log")
      .select("details")
      .eq("action", "scrape")
      .gte("created_at", todayStart)
      .order("created_at", { ascending: false })
      .limit(10);
    for (const log of todayLog || []) {
      if (log.details?.fscs_scraped_list) {
        alreadyScrapedToday.push(...log.details.fscs_scraped_list);
      }
    }
  } catch {}

  const alreadySet = new Set(alreadyScrapedToday);
  const remainingFscs = fscsToScrape.filter(fsc => !alreadySet.has(fsc));
  const batchFscs = remainingFscs.slice(0, BATCH_SIZE);
  const moreRemaining = remainingFscs.length - batchFscs.length;

  // Accept consent
  try {
    await fetch(`${DIBBS_BASE}/dodwarning.aspx?goto=/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "butAgree=OK",
      redirect: "follow",
    });
  } catch {}

  // Scrape FSCs in parallel batches of 5 for speed
  for (let i = 0; i < batchFscs.length; i += 5) {
    const chunk = batchFscs.slice(i, i + 5);
    const results = await Promise.allSettled(
      chunk.map(async (fsc) => {
        const url = `${DIBBS_BASE}/Rfq/RfqRecs.aspx?category=FSC&value=${fsc}&scope=today`;
        const resp = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(10000) });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const html = await resp.text();
        return { fsc, items: parseTable(html, fsc) };
      })
    );
    for (const r of results) {
      if (r.status === "fulfilled") {
        allSolicitations.push(...r.value.items);
      } else {
        errors.push(r.reason?.message || "unknown error");
      }
    }
  }

  // Save to Supabase
  const supabase = createServiceClient();
  if (allSolicitations.length > 0) {
    for (let i = 0; i < allSolicitations.length; i += 100) {
      const batch = allSolicitations.slice(i, i + 100).map((s) => ({
        ...s,
        scraped_at: new Date().toISOString(),
        data_source: "dibbs_scrape",
        approved_parts: null,
        detail_url: null,
      }));
      await supabase
        .from("dibbs_solicitations")
        .upsert(batch, { onConflict: "solicitation_number,nsn", ignoreDuplicates: true });
    }
  }

  // Auto-enrich after scrape
  let enrichResult = null;
  try {
    const enrichResp = await fetch(
      new URL("/api/dibbs/enrich", process.env.RAILWAY_PUBLIC_DOMAIN
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
        : "http://localhost:3000"
      ).toString(),
      { method: "POST", headers: { Cookie: "" } }
    );
    if (enrichResp.ok) enrichResult = await enrichResp.json();
  } catch {}

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  const result = {
    success: true,
    count: allSolicitations.length,
    fscs_scraped: batchFscs.length,
    fscs_scraped_list: batchFscs,
    fscs_total_expansion: fscsToScrape.length,
    fscs_from_lamlinks: skippedFscs.length,
    fscs_remaining: moreRemaining,
    errors,
    elapsed_seconds: parseFloat(elapsed),
    enrich: enrichResult,
  };

  // Log sync
  await supabase.from("sync_log").insert({
    action: "scrape",
    details: result,
  });

  return NextResponse.json(result);
}
