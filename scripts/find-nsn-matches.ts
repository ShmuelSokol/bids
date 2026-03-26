/**
 * Find potential NSN matches for unsourceable solicitations.
 * Compares part numbers + descriptions against AX, LamLinks, and Master DB.
 *
 * Run: npx tsx scripts/find-nsn-matches.ts
 */
import "dotenv/config";
import sql from "mssql/msnodesqlv8";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";

const llConfig = {
  connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jzgvdfzboknpcrhymjob.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Simple word-based similarity score (0-1)
function titleSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const wordsA = new Set(a.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let matches = 0;
  for (const w of wordsA) if (wordsB.has(w)) matches++;
  return matches / Math.max(wordsA.size, wordsB.size);
}

async function main() {
  console.log("=== Find NSN Matches for Unsourceable Items ===\n");

  // Step 1: Load unsourceable solicitations with PUB LOG data
  console.log("Step 1: Loading unsourceable solicitations + PUB LOG data...");
  const unsourceable: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await sb.from("dibbs_solicitations")
      .select("nsn, nomenclature, fsc, solicitation_number")
      .eq("is_sourceable", false)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    unsourceable.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  console.log(`  ${unsourceable.length} unsourceable solicitations`);

  // Load PUB LOG part numbers
  const publogMap = new Map<string, { part_number: string; cage_code: string }>();
  let pPage = 0;
  while (true) {
    const { data } = await sb.from("publog_nsns")
      .select("nsn, part_number, cage_code")
      .range(pPage * 1000, (pPage + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    for (const r of data) {
      if (r.part_number) publogMap.set(r.nsn, { part_number: r.part_number, cage_code: r.cage_code || "" });
    }
    if (data.length < 1000) break;
    pPage++;
  }
  console.log(`  ${publogMap.size} PUB LOG part numbers loaded`);

  // Step 2: Load AX catalog (NSN + descriptions)
  console.log("\nStep 2: Loading AX catalog from Supabase...");
  const axItems: any[] = [];
  let aPage = 0;
  while (true) {
    const { data } = await sb.from("nsn_catalog").select("nsn, item_number, description").range(aPage * 1000, (aPage + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    axItems.push(...data);
    if (data.length < 1000) break;
    aPage++;
  }
  console.log(`  ${axItems.length} AX NSN catalog items`);

  // Build AX description lookup
  const axByDesc = axItems.map(a => ({
    nsn: a.nsn,
    item: a.item_number,
    desc: (a.description || "").trim().toLowerCase(),
  }));

  // Step 3: Load LamLinks item master (part numbers + descriptions)
  console.log("\nStep 3: Loading LamLinks item master (365K items)...");
  const pool = await sql.connect(llConfig);
  const llResult = await pool.request().query(`
    SELECT partno_k08 AS part_number, p_cage_k08 AS cage, p_desc_k08 AS description,
           fsc_k08 AS fsc, niin_k08 AS niin
    FROM k08_tab
    WHERE partno_k08 IS NOT NULL
  `);
  const llItems = llResult.recordset;
  console.log(`  ${llItems.length} LamLinks items with part numbers`);

  // Build LamLinks part number lookup
  const llByPartNo = new Map<string, any>();
  for (const item of llItems) {
    const pn = (item.part_number || "").trim();
    if (pn) llByPartNo.set(pn, item);
  }

  // Build LamLinks description list for fuzzy matching
  const llByDesc = llItems.map(item => ({
    partNo: (item.part_number || "").trim(),
    cage: (item.cage || "").trim(),
    desc: (item.description || "").trim().toLowerCase(),
    fsc: (item.fsc || "").trim(),
    niin: (item.niin || "").trim(),
  }));

  await pool.close();

  // Step 4: Load Master DB items
  console.log("\nStep 4: Loading Master DB items...");
  let masterItems: any[] = [];
  try {
    const KEY = process.env.MASTERDB_API_KEY;
    if (KEY) {
      const resp = await fetch("https://masterdb.everreadygroup.com/api/dibs/items/export?has_nsn=1", {
        headers: { "X-Api-Key": KEY },
        signal: AbortSignal.timeout(30000),
      });
      if (resp.ok) masterItems = await resp.json();
    }
  } catch {}
  console.log(`  ${masterItems.length} Master DB items`);

  const masterByDesc = masterItems.map((m: any) => ({
    sku: m.sku || "",
    desc: ((m.title || "") + " " + (m.description || "")).toLowerCase(),
    nsn: m.nsn || "",
    mfr: m.mfr_part_number || "",
  }));

  // Step 5: Match!
  console.log("\nStep 5: Matching unsourceable items...\n");

  const matches: any[] = [];

  for (const sol of unsourceable) {
    const publog = publogMap.get(sol.nsn);
    const solDesc = (sol.nomenclature || "").trim().toLowerCase();
    const solPartNo = publog?.part_number?.trim() || "";

    // Match 1: Exact part number match in LamLinks
    if (solPartNo && llByPartNo.has(solPartNo)) {
      const ll = llByPartNo.get(solPartNo);
      matches.push({
        nsn: sol.nsn,
        nomenclature: sol.nomenclature,
        match_type: "PART_NUMBER_EXACT",
        confidence: "HIGH",
        matched_part: solPartNo,
        matched_desc: ll.description?.trim(),
        matched_source: "LamLinks",
        matched_fsc: ll.fsc?.trim(),
        matched_niin: ll.niin?.trim(),
        action: `Add NSN barcode ${sol.nsn} to AX item with part# ${solPartNo}`,
      });
      continue;
    }

    // Match 2: Title similarity against AX descriptions
    let bestAxMatch = { score: 0, item: null as any };
    for (const ax of axByDesc) {
      const score = titleSimilarity(solDesc, ax.desc);
      if (score > bestAxMatch.score) bestAxMatch = { score, item: ax };
    }
    if (bestAxMatch.score >= 0.6 && bestAxMatch.item) {
      matches.push({
        nsn: sol.nsn,
        nomenclature: sol.nomenclature,
        match_type: "TITLE_SIMILARITY_AX",
        confidence: bestAxMatch.score >= 0.8 ? "HIGH" : "MEDIUM",
        matched_part: bestAxMatch.item.item,
        matched_desc: bestAxMatch.item.desc,
        matched_source: "AX",
        matched_fsc: "",
        matched_niin: bestAxMatch.item.nsn,
        similarity: Math.round(bestAxMatch.score * 100) + "%",
        action: `Verify AX item ${bestAxMatch.item.item} (${bestAxMatch.item.nsn}) matches ${sol.nsn}`,
      });
      continue;
    }

    // Match 3: Title similarity against LamLinks descriptions
    let bestLlMatch = { score: 0, item: null as any };
    // Only check items in same FSC for speed
    const sameFscItems = llByDesc.filter(l => l.fsc === sol.fsc);
    for (const ll of sameFscItems) {
      const score = titleSimilarity(solDesc, ll.desc);
      if (score > bestLlMatch.score) bestLlMatch = { score, item: ll };
    }
    if (bestLlMatch.score >= 0.5 && bestLlMatch.item) {
      matches.push({
        nsn: sol.nsn,
        nomenclature: sol.nomenclature,
        match_type: "TITLE_SIMILARITY_LL",
        confidence: bestLlMatch.score >= 0.7 ? "MEDIUM" : "LOW",
        matched_part: bestLlMatch.item.partNo,
        matched_desc: bestLlMatch.item.desc,
        matched_source: "LamLinks",
        matched_fsc: bestLlMatch.item.fsc,
        matched_niin: bestLlMatch.item.niin,
        similarity: Math.round(bestLlMatch.score * 100) + "%",
        action: `Check if LamLinks item ${bestLlMatch.item.partNo} (${bestLlMatch.item.fsc}-${bestLlMatch.item.niin}) is same as ${sol.nsn}`,
      });
      continue;
    }

    // Match 4: Title similarity against Master DB
    let bestMasterMatch = { score: 0, item: null as any };
    for (const m of masterByDesc) {
      const score = titleSimilarity(solDesc, m.desc);
      if (score > bestMasterMatch.score) bestMasterMatch = { score, item: m };
    }
    if (bestMasterMatch.score >= 0.5 && bestMasterMatch.item) {
      matches.push({
        nsn: sol.nsn,
        nomenclature: sol.nomenclature,
        match_type: "TITLE_SIMILARITY_MASTER",
        confidence: bestMasterMatch.score >= 0.7 ? "MEDIUM" : "LOW",
        matched_part: bestMasterMatch.item.mfr || bestMasterMatch.item.sku,
        matched_desc: bestMasterMatch.item.desc.slice(0, 100),
        matched_source: "MasterDB",
        matched_fsc: "",
        matched_niin: bestMasterMatch.item.nsn,
        similarity: Math.round(bestMasterMatch.score * 100) + "%",
        action: `Check Master DB SKU ${bestMasterMatch.item.sku}`,
      });
    }
  }

  // Step 6: Report
  console.log("=== RESULTS ===\n");
  const byType = { PART_NUMBER_EXACT: 0, TITLE_SIMILARITY_AX: 0, TITLE_SIMILARITY_LL: 0, TITLE_SIMILARITY_MASTER: 0 };
  const byConf = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const m of matches) {
    byType[m.match_type as keyof typeof byType]++;
    byConf[m.confidence as keyof typeof byConf]++;
  }

  console.log(`Total matches: ${matches.length} out of ${unsourceable.length} unsourceable`);
  console.log(`\nBy type:`);
  console.log(`  Part number exact:     ${byType.PART_NUMBER_EXACT}`);
  console.log(`  Title match (AX):      ${byType.TITLE_SIMILARITY_AX}`);
  console.log(`  Title match (LL):      ${byType.TITLE_SIMILARITY_LL}`);
  console.log(`  Title match (Master):  ${byType.TITLE_SIMILARITY_MASTER}`);
  console.log(`\nBy confidence:`);
  console.log(`  HIGH:   ${byConf.HIGH}`);
  console.log(`  MEDIUM: ${byConf.MEDIUM}`);
  console.log(`  LOW:    ${byConf.LOW}`);

  // Save CSV report
  const csv = ["NSN,Nomenclature,Match Type,Confidence,Matched Part,Matched Desc,Source,Action"];
  for (const m of matches) {
    csv.push(`"${m.nsn}","${m.nomenclature}","${m.match_type}","${m.confidence}","${m.matched_part}","${(m.matched_desc || "").slice(0, 80)}","${m.matched_source}","${m.action}"`);
  }
  writeFileSync("C:/tmp/nsn-match-report.csv", csv.join("\n"));
  console.log(`\nReport saved: C:/tmp/nsn-match-report.csv`);

  // Save to Supabase for display on site
  await sb.from("sync_log").insert({
    action: "nsn_match_report",
    details: { total_unsourceable: unsourceable.length, matches: matches.length, by_type: byType, by_confidence: byConf },
  });
}

main().catch(console.error);
