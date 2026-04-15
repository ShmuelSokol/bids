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

async function getAxToken() {
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
  if (!d.access_token) throw new Error("AX auth failed: " + d.error_description);
  return d.access_token;
}

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

  // 2. NSN check against AX ProductBarcodesV3
  const nsnsOnFile = new Set(rows.map((r) => (r.nsn || "").trim()).filter(Boolean));
  const digitsMap = new Map<string, string>(); // digits → display nsn
  for (const nsn of nsnsOnFile) {
    const digits = nsn.replace(/-/g, "");
    if (digits.length === 13) digitsMap.set(digits, nsn);
  }
  const foundNsns = new Set<string>();
  try {
    const token = await getAxToken();
    const D = process.env.AX_D365_URL!;
    const digitsArr = Array.from(digitsMap.keys());
    for (let i = 0; i < digitsArr.length; i += 40) {
      const chunk = digitsArr.slice(i, i + 40);
      const filter = chunk.map((d) => `Barcode eq '${d}'`).join(" or ");
      const url = `${D}/data/ProductBarcodesV3?cross-company=true&$filter=BarcodeSetupId eq 'NSN' and (${encodeURIComponent(filter)})&$select=Barcode,ItemNumber`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) continue;
      const d: any = await r.json();
      for (const row of d.value || []) if (row.Barcode) foundNsns.add(row.Barcode);
    }
  } catch (e: any) {
    console.error("AX NSN lookup failed:", e?.message);
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
