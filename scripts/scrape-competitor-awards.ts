/**
 * Scrape DIBBS awards page for every active sourceable NSN.
 * Populates the `awards` table with competitor wins (any non-0AG09
 * CAGE) so the NSN history panel shows who else has been winning.
 *
 * Runs locally (the office Windows box can reach DIBBS; Railway can't
 * — its IPs return `fetch failed` on the consent flow). Triggered by
 * the "DIBS - Competitor Awards Scrape" Windows scheduled task daily.
 *
 *   npx tsx scripts/scrape-competitor-awards.ts
 */
import "./env";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jzgvdfzboknpcrhymjob.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DIBBS_BASE = "https://www.dibbs.bsm.dla.mil";

/** Accept DIBBS consent (ASP.NET __VIEWSTATE + dw cookie). */
async function getDibbsCookies(): Promise<string> {
  const consentPage = await fetch(`${DIBBS_BASE}/dodwarning.aspx?goto=/`, { redirect: "manual" });
  const consentHtml = await consentPage.text();
  const getCookies = consentPage.headers.getSetCookie?.() || [];
  const initialCookies = getCookies.map((c) => c.split(";")[0]).join("; ");
  const fields: Record<string, string> = {};
  const re = /<input[^>]*type="hidden"[^>]*name="([^"]+)"[^>]*value="([^"]*)"/gi;
  let m;
  while ((m = re.exec(consentHtml)) !== null) fields[m[1]] = m[2];
  const params = new URLSearchParams(fields);
  params.append("butAgree", "OK");
  const postResp = await fetch(`${DIBBS_BASE}/dodwarning.aspx?goto=/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: initialCookies },
    body: params.toString(),
    redirect: "manual",
  });
  const postCookies = postResp.headers.getSetCookie?.() || [];
  const merged = new Map<string, string>();
  for (const c of [...getCookies, ...postCookies]) {
    const [kv] = c.split(";");
    const [k] = kv.split("=");
    if (kv.includes("=") && !kv.endsWith("=")) merged.set(k.trim(), kv);
  }
  return [...merged.values()].join("; ");
}

function parseAwardTable(html: string): Array<{
  contract_number: string;
  cage: string;
  unit_price: number;
  award_date: string;
  fsc: string;
  niin: string;
  description: string;
}> {
  const out: any[] = [];
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
    if (cells.length < 9) continue;
    const contractMatch = cells[0]?.match(/(SPE\S+|SPM\S+)/);
    const cage = (cells[4] || "").trim();
    const priceStr = (cells[5] || "").replace(/[$,]/g, "");
    const awardDate = (cells[6] || "").trim();
    const nsnRaw = (cells[8] || "").replace(/\s/g, "");
    const description = (cells[9] || "").trim();
    if (!contractMatch || !cage || !nsnRaw) continue;
    const nsnParts = nsnRaw.split("-");
    if (nsnParts.length < 2) continue;
    const fsc = nsnParts[0];
    const niin = nsnParts.slice(1).join("-");
    const price = parseFloat(priceStr);
    if (!isFinite(price) || price <= 0) continue;
    out.push({
      contract_number: contractMatch[1],
      cage,
      unit_price: price,
      award_date: awardDate,
      fsc,
      niin,
      description,
    });
  }
  return out;
}

async function fetchAwardsForNsn(nsn: string, cookies: string): Promise<any[]> {
  const cleanNsn = nsn.replace(/-/g, "");
  const url = `${DIBBS_BASE}/Awards/AwdRecs.aspx?category=NIIN&value=${cleanNsn}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const resp = await fetch(url, {
      headers: { Cookie: cookies },
      signal: ctrl.signal,
    });
    if (!resp.ok) return [];
    const html = await resp.text();
    return parseAwardTable(html);
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  console.log("=== Competitor Awards Scrape ===");
  console.log(`Started: ${new Date().toISOString()}`);

  // Pull every active sourceable NSN — these are the ones Abe might bid on.
  const nsns: string[] = [];
  let page = 0;
  while (true) {
    const { data } = await sb
      .from("dibbs_solicitations")
      .select("nsn")
      .eq("is_sourceable", true)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    for (const r of data) if (r.nsn) nsns.push(r.nsn);
    if (data.length < 1000) break;
    page++;
    if (page >= 10) break; // 10K NSNs cap
  }
  const unique = [...new Set(nsns)];
  console.log(`${unique.length} unique sourceable NSNs to check`);

  const cookies = await getDibbsCookies();
  console.log("DIBBS consent OK");

  let scraped = 0;
  let foundRows = 0;
  let savedRows = 0;
  let skippedRecent = 0;
  const startedAt = Date.now();
  // Skip any NSN whose competitor awards we already pulled in the last 7 days.
  const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentLog } = await sb
    .from("sync_log")
    .select("details")
    .eq("action", "competitor_award_nsn")
    .gte("created_at", recentCutoff)
    .limit(20000);
  const recentNsns = new Set((recentLog || []).map((l: any) => l.details?.nsn).filter(Boolean));

  // Process in chunks so we can log progress + commit batches.
  const CHUNK = 25;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK).filter((n) => !recentNsns.has(n));
    skippedRecent += unique.slice(i, i + CHUNK).length - chunk.length;
    if (chunk.length === 0) continue;

    const batchRows: any[] = [];
    const seenInBatch = new Set<string>();
    for (const nsn of chunk) {
      scraped++;
      const rows = await fetchAwardsForNsn(nsn, cookies);
      foundRows += rows.length;
      for (const r of rows) {
        const k = `${r.contract_number}_${r.fsc}_${r.niin}_${r.cage}`;
        if (seenInBatch.has(k)) continue;
        seenInBatch.add(k);
        batchRows.push({
          contract_number: r.contract_number,
          cage: r.cage,
          fsc: r.fsc,
          niin: r.niin,
          unit_price: r.unit_price,
          quantity: 1, // DIBBS awards page doesn't expose qty per line cleanly
          description: r.description,
          award_date: r.award_date || null,
          data_source: "dibbs_competitor",
        });
      }
      // Be polite to DIBBS — small delay between requests
      await new Promise((r) => setTimeout(r, 200));
    }
    if (batchRows.length > 0) {
      const { error, count } = await sb
        .from("awards")
        .upsert(batchRows, { onConflict: "contract_number,fsc,niin", count: "exact", ignoreDuplicates: false });
      if (error) {
        console.warn(`  upsert error (chunk ${i / CHUNK + 1}):`, error.message);
      } else {
        savedRows += count || batchRows.length;
      }
    }
    // Mark each scraped NSN with sync_log so we don't re-scrape it for 7 days.
    const logRows = chunk.map((nsn) => ({
      action: "competitor_award_nsn",
      details: { nsn, found: 0 },
    }));
    await sb.from("sync_log").insert(logRows);

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
    console.log(`  chunk ${i / CHUNK + 1}: scraped ${chunk.length} NSNs (total scraped ${scraped}, found ${foundRows}, saved ${savedRows}) — ${elapsed}s`);
  }

  await sb.from("sync_log").insert({
    action: "competitor_awards_scrape",
    details: {
      total_sourceable_nsns: unique.length,
      scraped,
      skipped_recent: skippedRecent,
      found_rows: foundRows,
      saved_rows: savedRows,
      elapsed_seconds: (Date.now() - startedAt) / 1000,
    },
  });

  console.log(`\nDone. scraped=${scraped} found=${foundRows} saved=${savedRows} skipped=${skippedRecent}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
