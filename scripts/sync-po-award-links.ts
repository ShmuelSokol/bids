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
  const all: any[] = [];
  let next: string | null = url;
  while (next && all.length < max) {
    const r = await fetch(next, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) {
      console.error(`  HTTP ${r.status} on ${next.slice(0, 100)}`);
      break;
    }
    const d: any = await r.json();
    all.push(...(d.value || []));
    next = d["@odata.nextLink"] || null;
  }
  return all;
}

async function main() {
  console.log("=== DD219 PO → Award linker ===\n");
  const token = await getToken();
  const D = process.env.AX_D365_URL!;

  // 1. Pull ALL DD219 PO lines, then the headers for those POs.
  //    Filter client-side to headers from last 400d (matches awards
  //    retention window).
  console.log("1. Pulling all DD219 PO lines from AX...");
  const poLinesRaw = await fetchAll(
    token,
    `${D}/data/PurchaseOrderLinesV2?cross-company=true&$filter=(CustomerRequisitionNumber eq 'DD219' or CustomerRequisitionNumber eq 'dd219')&$select=PurchaseOrderNumber,LineNumber,ItemNumber,OrderedPurchaseQuantity,PurchasePrice,PurchaseOrderLineStatus,RequestedDeliveryDate&$top=1000`,
    5000
  );
  console.log(`   ${poLinesRaw.length} DD219 lines total`);

  const allPoNums = [...new Set(poLinesRaw.map((l: any) => l.PurchaseOrderNumber))];
  console.log(`   ${allPoNums.length} distinct POs — fetching headers...`);
  const headers: any[] = [];
  for (let i = 0; i < allPoNums.length; i += 40) {
    const chunk = allPoNums.slice(i, i + 40);
    const filter = chunk.map((n) => `PurchaseOrderNumber eq '${n}'`).join(" or ");
    const url = `${D}/data/PurchaseOrderHeadersV2?cross-company=true&$filter=${encodeURIComponent(filter)}&$select=PurchaseOrderNumber,OrderVendorAccountNumber,AccountingDate`;
    headers.push(...(await fetchAll(token, url)));
  }
  console.log(`   ${headers.length} headers fetched`);

  // No date gate on POs — AX only has 547 DD219 POs total (Dec 2024-Mar
  // 2025 range). Keep them all, let the award date window do the work.
  const poLines = poLinesRaw;
  console.log(`   Using all ${poLines.length} DD219 lines`);
  if (poLines.length === 0) return;

  const headerByPo = new Map<string, any>(headers.map((h: any) => [h.PurchaseOrderNumber, h]));

  // 3. Resolve ItemNumber → NSN via ProductBarcodesV3
  const itemNums = [...new Set(poLines.map((l: any) => l.ItemNumber).filter(Boolean))];
  console.log(`\n3. Resolving ${itemNums.length} item numbers to NSNs...`);
  const itemToNsn = new Map<string, string>();
  for (let i = 0; i < itemNums.length; i += 40) {
    const chunk = itemNums.slice(i, i + 40);
    const filter = chunk.map((it) => `ItemNumber eq '${it}'`).join(" or ");
    const url = `${D}/data/ProductBarcodesV3?cross-company=true&$filter=BarcodeSetupId eq 'NSN' and (${encodeURIComponent(filter)})&$select=ItemNumber,Barcode`;
    const rows = await fetchAll(token, url);
    for (const r of rows) {
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
