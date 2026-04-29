/**
 * Heuristic linker: AX DD219 PO lines → DIBS awards.
 *
 * No direct OData linkage exists between AX purchase orders and the
 * LamLinks awards they fulfill (every field on PurchaseOrderLinesV2
 * was scanned; nothing carries an award / contract / SO back-reference).
 * So we match by (NSN + quantity + date proximity), scoring each match.
 *
 * Flow:
 *   1. Pull every DD219 PO line from AX (toupper match so we catch
 *      both DD219 and dd219 variants)
 *   2. Resolve each line's ItemNumber → NSN via AX ProductBarcodesV3
 *   3. For each (NSN, po_ordered_date) pair, find candidate awards
 *      in DIBS `awards` where award_date is between 1 and 60 days
 *      BEFORE po_ordered_date
 *   4. Score: exact-qty match + 1-to-1 candidate = high confidence;
 *      multiple candidates or qty mismatch = medium or low
 *   5. Upsert into po_award_links keyed on (ax_po_number, ax_line_number)
 *
 * Runs on-demand + daily via Windows Task Scheduler.
 *
 *   npx tsx scripts/sync-po-award-links.ts
 */
import "./env";
import { createClient } from "@supabase/supabase-js";
import { fetchAxByMonth, fetchAxPaginated } from "./ax-fetch";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getToken() {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.AX_CLIENT_ID!,
    client_secret: process.env.AX_CLIENT_SECRET!,
    scope: `${process.env.AX_D365_URL}/.default`,
  });
  const r = await fetch(
    `https://login.microsoftonline.com/${process.env.AX_TENANT_ID}/oauth2/v2.0/token`,
    { method: "POST", body: params }
  );
  const d: any = await r.json();
  if (!d.access_token) throw new Error("AX auth failed");
  return d.access_token;
}

async function fetchAll(token: string, url: string, max = 10000) {
  // Thin shim to the shared helper, which also detects the AX silent
  // 1000-row cap on filtered queries (see scripts/ax-fetch.ts).
  const { rows } = await fetchAxPaginated(token, url, { maxRows: max });
  return rows;
}

// Run N async tasks with bounded concurrency. Returns results in input order.
async function pMap<T, R>(items: T[], concurrency: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIdx = 0;
  async function worker() {
    while (true) {
      const i = nextIdx++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function main() {
  const FULL = process.argv.includes("--full");
  const NO_INCREMENTAL = process.argv.includes("--no-incremental");
  console.log(`=== DD219 PO → Award linker ${FULL ? "(--full)" : NO_INCREMENTAL ? "(no incremental)" : "(incremental default)"} ===\n`);
  const token = await getToken();
  const D = process.env.AX_D365_URL!;

  // 0. Incremental cutoff: if previous sync_log entry exists, only fetch POs
  // since then. First-ever run + --full bypass this and do all 24 months.
  let monthsBack = 24;
  let sinceDate: string | null = null;
  if (!FULL && !NO_INCREMENTAL) {
    const { data: lastRun } = await sb
      .from("sync_log")
      .select("created_at")
      .eq("action", "po_award_link_sync")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastRun?.created_at) {
      // Re-process from 7 days before last run for safety (PO dates can be backdated)
      const since = new Date(new Date(lastRun.created_at).getTime() - 7 * 86_400_000);
      sinceDate = since.toISOString().slice(0, 10);
      const daysBack = Math.ceil((Date.now() - since.getTime()) / 86_400_000);
      monthsBack = Math.max(1, Math.ceil(daysBack / 30));
      console.log(`Incremental: last run ${lastRun.created_at.slice(0, 10)}, fetching POs since ${sinceDate} (~${daysBack}d, ${monthsBack}mo)`);
    } else {
      console.log("No prior sync_log entry — falling back to full 24-month pull");
    }
  }

  // 1. AX OData silently caps any single filter at 1000 rows (no
  //    nextLink beyond that). fetchAxByMonth auto-chunks by month so
  //    each request stays under the cap, and flags truncated=true if
  //    any single month exceeds 1000.
  console.log(`\n1. Pulling PO headers by month (${monthsBack} months)...`);
  const { rows: headersAll, truncated: hdrTruncated } = await fetchAxByMonth(token, {
    D365_URL: D,
    entity: "PurchaseOrderHeadersV2",
    dateField: "AccountingDate",
    monthsBack,
    select: ["PurchaseOrderNumber", "OrderVendorAccountNumber", "AccountingDate"],
  });
  if (hdrTruncated) console.warn("   ⚠ One or more months exceeded 1000 headers — narrow chunk window.");
  // Apply incremental cutoff (sinceDate); fetchAxByMonth gave us monthsBack months,
  // but we want only the headers strictly >= sinceDate.
  const headers = sinceDate
    ? headersAll.filter((h: any) => h.AccountingDate && String(h.AccountingDate).slice(0, 10) >= sinceDate!)
    : headersAll;
  console.log(`   ${headersAll.length} headers pulled (${headers.length} after sinceDate filter)`);

  // 2. Pull DD219 lines, parallel chunks of 40 PO numbers per request
  console.log("\n2. Pulling DD219 lines (parallel, concurrency=5)...");
  const headerChunks: any[][] = [];
  for (let i = 0; i < headers.length; i += 40) headerChunks.push(headers.slice(i, i + 40));
  let chunksDone = 0;
  const chunkResults = await pMap(headerChunks, 5, async (chunk) => {
    const filter = chunk.map((h: any) => `PurchaseOrderNumber eq '${h.PurchaseOrderNumber}'`).join(" or ");
    const ddFilter = `(CustomerRequisitionNumber eq 'DD219' or CustomerRequisitionNumber eq 'dd219') and (${filter})`;
    const url = `${D}/data/PurchaseOrderLinesV2?cross-company=true&$filter=${encodeURIComponent(ddFilter)}&$select=PurchaseOrderNumber,LineNumber,ItemNumber,OrderedPurchaseQuantity,PurchasePrice,PurchaseOrderLineStatus,RequestedDeliveryDate&$top=500`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    chunksDone++;
    if (chunksDone % 20 === 0) console.log(`   ...${chunksDone}/${headerChunks.length} chunks done`);
    if (!r.ok) return [];
    const d: any = await r.json();
    return d.value || [];
  });
  const poLines: any[] = chunkResults.flat();
  console.log(`   Total DD219 lines found: ${poLines.length}`);
  if (poLines.length === 0) {
    // Still log the run so next incremental anchor moves forward
    await sb.from("sync_log").insert({ action: "po_award_link_sync", details: { po_lines_pulled: 0, linked: 0, mode: FULL ? "full" : "incremental", since: sinceDate } });
    console.log("Done (no lines to link).");
    return;
  }

  const headerByPo = new Map<string, any>(headers.map((h: any) => [h.PurchaseOrderNumber, h]));

  // 3. Resolve ItemNumber → NSN. Try local nsn_catalog (Supabase) FIRST —
  //    most items have already been mapped via the nightly catalog refresh.
  //    Only items missing locally get the AX ProductBarcodesV3 round-trip.
  const itemNums = Array.from(new Set(poLines.map((l: any) => l.ItemNumber).filter(Boolean))) as string[];
  console.log(`\n3a. Resolving ${itemNums.length} item numbers via local nsn_catalog...`);
  const itemToNsn = new Map<string, string>();
  // nsn_catalog stores `source` like "AX:HANHHTWBC". Pull all rows for items in our set.
  const sourceKeys = itemNums.map((it) => `AX:${it}`);
  for (let i = 0; i < sourceKeys.length; i += 500) {
    const slice = sourceKeys.slice(i, i + 500);
    const { data } = await sb.from("nsn_catalog").select("nsn, source").in("source", slice);
    if (data) for (const r of data) {
      const item = r.source?.replace("AX:", "") || null;
      if (item && r.nsn) itemToNsn.set(item, r.nsn);
    }
  }
  const localHits = itemToNsn.size;
  console.log(`   ${localHits}/${itemNums.length} resolved locally`);

  const missing = itemNums.filter((it) => !itemToNsn.has(it));
  if (missing.length > 0) {
    console.log(`\n3b. Falling back to AX ProductBarcodesV3 for ${missing.length} unresolved items (parallel, concurrency=5)...`);
    const missingChunks: string[][] = [];
    for (let i = 0; i < missing.length; i += 40) missingChunks.push(missing.slice(i, i + 40));
    const axResults = await pMap(missingChunks, 5, async (chunk) => {
      const filter = chunk.map((it) => `ItemNumber eq '${it}'`).join(" or ");
      const url = `${D}/data/ProductBarcodesV3?cross-company=true&$filter=BarcodeSetupId eq 'NSN' and (${encodeURIComponent(filter)})&$select=ItemNumber,Barcode`;
      return await fetchAll(token, url);
    });
    for (const rows of axResults) for (const r of rows) {
      if (r.ItemNumber && r.Barcode) {
        const digits = String(r.Barcode).replace(/-/g, "");
        if (digits.length === 13) {
          const nsn = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 9)}-${digits.slice(9)}`;
          itemToNsn.set(r.ItemNumber, nsn);
        }
      }
    }
  }
  console.log(`   resolved ${itemToNsn.size} / ${itemNums.length} to NSNs`);

  // 4. Pull our recent awards for those NSNs
  const nsnSet = new Set(itemToNsn.values());
  console.log(`\n4. Pulling DIBS awards for ${nsnSet.size} NSNs (last 2 years)...`);
  const awardsByNsn = new Map<string, any[]>();
  // Pull awards up to 2 years back — covers older DD219 POs too
  const cutoffIso = new Date(Date.now() - 730 * 86_400_000).toISOString();
  const nsnArr = Array.from(nsnSet);
  for (let i = 0; i < nsnArr.length; i += 50) {
    const chunk = nsnArr.slice(i, i + 50);
    const chunkSet = new Set(chunk);
    const { data } = await sb
      .from("awards")
      .select("id, fsc, niin, contract_number, unit_price, quantity, award_date")
      .eq("cage", "0AG09")
      .gte("award_date", cutoffIso)
      .in("fsc", chunk.map((n) => n.split("-")[0]));
    if (data) {
      for (const a of data) {
        const nsn = `${a.fsc}-${a.niin}`;
        if (!chunkSet.has(nsn)) continue;
        if (!awardsByNsn.has(nsn)) awardsByNsn.set(nsn, []);
        awardsByNsn.get(nsn)!.push(a);
      }
    }
  }
  const totalAwards = Array.from(awardsByNsn.values()).reduce((s, a) => s + a.length, 0);
  console.log(`   ${totalAwards} candidate awards across ${awardsByNsn.size} distinct NSNs`);

  // 5. Score each PO line against candidate awards
  console.log("\n5. Scoring matches + upserting po_award_links...");
  const upserts: any[] = [];
  let highCount = 0, medCount = 0, lowCount = 0, noMatch = 0;

  for (const line of poLines) {
    const item = line.ItemNumber;
    const nsn = itemToNsn.get(item);
    if (!nsn) continue;
    const header = headerByPo.get(line.PurchaseOrderNumber);
    const poDate = header?.AccountingDate ? new Date(header.AccountingDate).getTime() : null;
    // PO must come AFTER the award. Per Abe 2026-04-16: 'Abe does
    // not create purchase orders before winning an award. The PO
    // will probably be created a day or two or three or within the
    // week after it was awarded.' Window: 0-30 days after award.
    const candidates = (awardsByNsn.get(nsn) || []).filter((a) => {
      if (!poDate || !a.award_date) return false;
      const aDate = new Date(a.award_date).getTime();
      const diffDays = (poDate - aDate) / 86_400_000;
      return diffDays >= 0 && diffDays <= 30;
    });

    let best: any = null;
    let bestScore = 0;
    let reason = "";
    const poQty = Number(line.OrderedPurchaseQuantity) || 0;

    if (candidates.length === 0) {
      noMatch++;
      continue;
    }

    for (const a of candidates) {
      const aQty = Number(a.quantity) || 0;
      // Score combines: qty proximity + date proximity (closer = better)
      const poDateMs = poDate || 0;
      const aDateMs = a.award_date ? new Date(a.award_date).getTime() : 0;
      const days = (poDateMs - aDateMs) / 86_400_000;
      const dateScore = days <= 7 ? 1 : days <= 14 ? 0.85 : days <= 30 ? 0.6 : 0;

      let qtyScore = 0;
      if (aQty && poQty) {
        if (aQty === poQty) qtyScore = 1; // exact
        else if (poQty < aQty && aQty % poQty === 0) qtyScore = 0.8; // PO is a clean divisor (partial fulfillment)
        else if (Math.abs(aQty - poQty) / Math.max(aQty, poQty) < 0.2) qtyScore = 0.5; // within 20%
      }

      const score = qtyScore * 0.6 + dateScore * 0.4;
      if (score > bestScore) {
        bestScore = score;
        best = a;
        reason = `qty ${aQty}→${poQty} (${qtyScore.toFixed(1)}), PO ${Math.round(days)}d after award (${dateScore.toFixed(1)})`;
      }
    }

    if (!best || bestScore === 0) {
      noMatch++;
      continue;
    }

    let confidence: string;
    if (bestScore >= 0.8 && candidates.length === 1) { confidence = "high"; highCount++; }
    else if (bestScore >= 0.7) { confidence = "medium"; medCount++; }
    else { confidence = "low"; lowCount++; }

    upserts.push({
      award_id: best.id,
      ax_po_number: line.PurchaseOrderNumber,
      ax_line_number: Number(line.LineNumber) || 0,
      ax_item_number: item,
      nsn,
      po_qty: poQty,
      po_price: Number(line.PurchasePrice) || 0,
      po_ordered_date: header?.AccountingDate ? String(header.AccountingDate).slice(0, 10) : null,
      po_line_status: line.PurchaseOrderLineStatus,
      supplier: header?.OrderVendorAccountNumber || null,
      match_score: bestScore,
      match_reason: reason,
      confidence,
    });
  }

  console.log(`\n   High: ${highCount}   Medium: ${medCount}   Low: ${lowCount}   No match: ${noMatch}`);

  // Batch upsert
  for (let i = 0; i < upserts.length; i += 200) {
    const batch = upserts.slice(i, i + 200);
    const { error } = await sb
      .from("po_award_links")
      .upsert(batch, { onConflict: "ax_po_number,ax_line_number" });
    if (error) console.error(`  upsert batch ${i} error: ${error.message}`);
  }
  console.log(`\n   Upserted ${upserts.length} links.`);

  await sb.from("sync_log").insert({
    action: "po_award_link_sync",
    details: { po_lines_pulled: poLines.length, linked: upserts.length, high: highCount, medium: medCount, low: lowCount, no_match: noMatch },
  });

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
