import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";

/**
 * POST /api/so/validate
 *
 * Pre-validates a batch of LamLinks awards (from so_awards_intake)
 * against AX + the DIBS dodaac_map cache before Abe runs the MPI
 * Sales Order import. Flags two classes of issue upfront so DIBS
 * catches them before MPI does:
 *
 *   1. SHIP_TO_DODAAC not in dodaac_map → Abe needs to add the
 *      DODAAC→address_id mapping in AX (bottom of DODAAC list,
 *      click New, paste) AND in DIBS (so next validate passes).
 *   2. NSN with no matching ItemNumber in AX ProductBarcodesV3 →
 *      Abe creates the item via NPI or attaches NSN to existing.
 *
 * Input: { batch_id: string } — the upload batch to validate.
 *        OR omit batch_id to validate the most recent batch.
 */

// AX auth removed — SO validation now uses cached nsn_catalog instead of live AX queries

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const supabase = createServiceClient();
  const body = await req.json().catch(() => ({}));

  // Resolve which batch to validate. Default: most recent.
  let batchId: string | null = body.batch_id || null;
  if (!batchId) {
    const { data: latest } = await supabase
      .from("so_awards_intake")
      .select("batch_id")
      .order("uploaded_at", { ascending: false })
      .limit(1);
    batchId = latest?.[0]?.batch_id || null;
  }
  if (!batchId) {
    return NextResponse.json({ ready: [], dodaac_missing: [], nsn_missing: [], checked: 0, note: "No batches uploaded yet. Upload a LamLinks awards file first." });
  }

  // Pull rows for this batch (paginate — can exceed 1K)
  const rows: any[] = [];
  for (let p = 0; p < 10; p++) {
    const { data } = await supabase
      .from("so_awards_intake")
      .select("*")
      .eq("batch_id", batchId)
      .range(p * 1000, (p + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }

  if (rows.length === 0) {
    return NextResponse.json({ ready: [], dodaac_missing: [], nsn_missing: [], checked: 0 });
  }

  // 1. DODAAC check against dodaac_map
  const dodaacsOnFile = new Set(rows.map((r) => (r.ship_to_dodaac || "").trim()).filter(Boolean));
  const { data: knownDodaacRows } = await supabase
    .from("dodaac_map")
    .select("dodaac")
    .in("dodaac", Array.from(dodaacsOnFile));
  const knownDodaacs = new Set((knownDodaacRows || []).map((r: any) => r.dodaac));

  // 2. NSN check against cached nsn_catalog (refreshed nightly from AX)
  const nsnsOnFile = [...new Set(rows.map((r) => (r.nsn || "").trim()).filter(Boolean))];
  const foundNsns = new Set<string>();
  for (let i = 0; i < nsnsOnFile.length; i += 500) {
    const chunk = nsnsOnFile.slice(i, i + 500);
    const { data } = await supabase.from("nsn_catalog").select("nsn").in("nsn", chunk);
    for (const r of data || []) {
      const digits = r.nsn.replace(/-/g, "");
      foundNsns.add(digits);
    }
  }

  // Bucket the awards
  const dodaacMissing: Record<string, { dodaac: string; awards: any[] }> = {};
  const nsnMissing: Record<string, { nsn: string; awards: any[]; part_no_hint: string | null }> = {};
  const ready: any[] = [];

  for (const a of rows) {
    const dodaac = (a.ship_to_dodaac || "").trim();
    const nsn = (a.nsn || "").trim();
    const digits = nsn.replace(/-/g, "");
    const dodaacOk = !dodaac || knownDodaacs.has(dodaac);
    const nsnOk = !nsn || foundNsns.has(digits);
    if (!dodaacOk) {
      if (!dodaacMissing[dodaac]) dodaacMissing[dodaac] = { dodaac, awards: [] };
      dodaacMissing[dodaac].awards.push(a);
    }
    if (!nsnOk) {
      if (!nsnMissing[nsn]) nsnMissing[nsn] = { nsn, awards: [], part_no_hint: a.part_no || null };
      nsnMissing[nsn].awards.push(a);
    }
    if (dodaacOk && nsnOk) ready.push(a);
  }

  return NextResponse.json({
    batch_id: batchId,
    checked: rows.length,
    ready,
    dodaac_missing: Object.values(dodaacMissing),
    nsn_missing: Object.values(nsnMissing),
  });
}
