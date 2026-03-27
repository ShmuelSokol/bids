import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

const DIBBS_BASE = "https://www.dibbs.bsm.dla.mil";

/**
 * POST /api/dibbs/awards
 * Scrapes DIBBS awards page for a batch of NSNs.
 * Saves winner CAGE + price to awards table.
 */

function parseAwardTable(html: string): Array<{
  contract: string;
  cage: string;
  price: number;
  award_date: string;
  nsn: string;
  nomenclature: string;
}> {
  const results: any[] = [];
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  while ((match = rowPattern.exec(html)) !== null) {
    const row = match[1];
    if (!row.includes("SPE") && !row.includes("SPM")) continue;
    const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let cm;
    while ((cm = cellPattern.exec(row)) !== null) {
      cells.push(cm[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim());
    }
    // DIBBS award table: contract, delivery order, counter, mod date, awardee CAGE, total price, award date, posted date, NSN, nomenclature, PR, solicitation
    if (cells.length >= 8) {
      const contractMatch = cells[0]?.match(/(SPE\S+|SPM\S+)/);
      const cage = cells[4]?.trim() || "";
      const priceStr = cells[5]?.replace(/[$,]/g, "") || "0";
      const awardDate = cells[6]?.trim() || "";
      const nsn = cells[8]?.replace(/\s/g, "") || "";
      const nomenclature = cells[9]?.trim() || "";

      if (contractMatch && cage) {
        results.push({
          contract: contractMatch[1],
          cage,
          price: parseFloat(priceStr) || 0,
          award_date: awardDate,
          nsn,
          nomenclature,
        });
      }
    }
  }
  return results;
}

export async function POST(req: NextRequest) {
  const { nsns } = await req.json();
  if (!nsns || !Array.isArray(nsns) || nsns.length === 0) {
    return NextResponse.json({ error: "nsns array required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Accept DIBBS consent
  try {
    await fetch(`${DIBBS_BASE}/dodwarning.aspx?goto=/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "butAgree=OK",
      redirect: "follow",
    });
  } catch {}

  const allAwards: any[] = [];
  const errors: string[] = [];

  // Process up to 10 NSNs per call
  for (const nsn of nsns.slice(0, 10)) {
    try {
      const cleanNsn = nsn.replace(/-/g, "");
      const url = `${DIBBS_BASE}/Awards/AwdRecs.aspx?category=NSN&value=${cleanNsn}&scope=all`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const resp = await fetch(url, { redirect: "follow", signal: controller.signal });
        if (!resp.ok) { errors.push(`${nsn}: HTTP ${resp.status}`); continue; }
        const html = await resp.text();
        const awards = parseAwardTable(html);
        allAwards.push(...awards.map(a => ({
          ...a,
          source_nsn: nsn,
        })));
      } finally {
        clearTimeout(timeout);
      }
    } catch (err: any) {
      errors.push(`${nsn}: ${err.message}`);
    }
  }

  // Save to usaspending_awards table (reuse for all public award data)
  let saved = 0;
  for (const a of allAwards) {
    const fsc = a.source_nsn.split("-")[0];
    const niin = a.source_nsn.split("-").slice(1).join("-");
    try {
      await supabase.from("awards").upsert({
        contract_number: a.contract,
        cage: a.cage,
        unit_price: a.price,
        quantity: 1,
        fsc,
        niin,
        description: a.nomenclature,
        award_date: a.award_date ? new Date(a.award_date).toISOString() : new Date().toISOString(),
        data_source: "dibbs_awards",
      }, { onConflict: "contract_number,fsc,niin", ignoreDuplicates: true });
      saved++;
    } catch {}
  }

  return NextResponse.json({
    nsns_searched: nsns.slice(0, 10).length,
    awards_found: allAwards.length,
    saved,
    errors,
  });
}
