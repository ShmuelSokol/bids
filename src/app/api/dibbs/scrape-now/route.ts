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
const TOP_FSCS = [
  "6515", "6505", "6510", "6530", "6550", "6640", "6520",
  "6630", "6532", "6540", "6545", "4240",
];

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

  // Check which FSCs are already covered by LamLinks import
  const supabaseCheck = createServiceClient();
  let llFscs: string[] = [];
  try {
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
  const fscsToScrape = TOP_FSCS.filter(fsc => !llFscs.includes(fsc));
  const skippedFscs = TOP_FSCS.filter(fsc => llFscs.includes(fsc));

  // First, accept consent by fetching the warning page
  try {
    await fetch(`${DIBBS_BASE}/dodwarning.aspx?goto=/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "butAgree=OK",
      redirect: "follow",
    });
  } catch {}

  // Scrape each FSC using "today" scope
  for (const fsc of fscsToScrape) {
    try {
      const url = `${DIBBS_BASE}/Rfq/RfqRecs.aspx?category=FSC&value=${fsc}&scope=today`;
      const resp = await fetch(url, { redirect: "follow" });
      if (!resp.ok) {
        errors.push(`FSC ${fsc}: HTTP ${resp.status}`);
        continue;
      }
      const html = await resp.text();
      const results = parseTable(html, fsc);
      allSolicitations.push(...results);
    } catch (err: any) {
      errors.push(`FSC ${fsc}: ${err.message}`);
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
    fscs_scraped: fscsToScrape.length,
    fscs_from_lamlinks: skippedFscs.length,
    lamlinks_fscs: skippedFscs,
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
