import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";

/**
 * POST /api/so/validate
 *
 * Pre-validates a batch of awards against AX before they flow through
 * Yosef's MPI Sales Order page. Surfaces two error types that Abe
 * currently only discovers AFTER running the MPI import:
 *
 *   1. DODAAC not mapped to a Dynamics address_id yet
 *   2. NSN has no matching ItemNumber in AX barcode table (or no
 *      valid UoM conversion)
 *
 * Input: { awardIds: number[] }  — defaults to all awards newer than
 *                                   last SO creation if omitted.
 *
 * Output:
 *   {
 *     ready: Award[],       — all green
 *     dodaac_missing: [{ dodaac, awards: [...] }],
 *     nsn_missing:    [{ nsn,    awards: [...], part_number_hint }]
 *   }
 *
 * Uses AX OData for the lookup (service principal is read-only and
 * DMF writes happen via Yosef's UI, so no write needed here).
 *
 * Note: awards table today doesn't carry DODAAC — that lives in the
 * LamLinks awards Excel file Abe downloads. For a full pre-validation
 * we'd need to either (a) pull DODAAC into the nightly k81 import or
 * (b) have DIBS auto-fetch Lamblinks' awards download. This route is
 * the scaffolding; column + population change coming next session.
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

  let awardsQ = supabase
    .from("awards")
    .select("id, contract_number, fsc, niin, unit_price, quantity, unit_of_measure, award_date")
    .eq("cage", "0AG09")
    .order("award_date", { ascending: false });
  if (Array.isArray(body.awardIds) && body.awardIds.length > 0) {
    awardsQ = awardsQ.in("id", body.awardIds);
  } else {
    awardsQ = awardsQ.limit(200);
  }
  const { data: awards, error } = await awardsQ;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!awards?.length) return NextResponse.json({ ready: [], dodaac_missing: [], nsn_missing: [] });

  // 1. NSN check against AX ProductBarcodesV3 (BarcodeSetupId='NSN')
  const token = await getAxToken();
  const D365_URL = process.env.AX_D365_URL!;

  // Chunk the NSN filter (AX OData has a URL length limit)
  const nsnMap = new Map<string, { fsc: string; niin: string; digits: string; barcodeFormatted: string }>();
  for (const a of awards) {
    if (!a.fsc || !a.niin) continue;
    const digits = `${a.fsc}${a.niin.replace(/-/g, "")}`;
    nsnMap.set(`${a.fsc}-${a.niin}`, {
      fsc: a.fsc,
      niin: a.niin,
      digits,
      barcodeFormatted: digits,
    });
  }
  const digitsSet = new Set(Array.from(nsnMap.values()).map((x) => x.digits));
  const foundNsns = new Set<string>();
  const digitsArr = Array.from(digitsSet);

  for (let i = 0; i < digitsArr.length; i += 40) {
    const chunk = digitsArr.slice(i, i + 40);
    const filter = chunk.map((d) => `Barcode eq '${d}'`).join(" or ");
    const url = `${D365_URL}/data/ProductBarcodesV3?cross-company=true&$filter=BarcodeSetupId eq 'NSN' and (${encodeURIComponent(filter)})&$select=Barcode,ItemNumber`;
    try {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) continue;
      const d: any = await r.json();
      for (const row of d.value || []) {
        if (row.Barcode) foundNsns.add(row.Barcode);
      }
    } catch (e) {
      // log + continue so one bad chunk doesn't sink the whole check
      console.error("AX NSN chunk failed:", (e as any)?.message);
    }
  }

  // 2. DODAAC check — skipped for now because awards table doesn't
  //    carry DODAAC yet. Stub the structure so the UI can show both
  //    buckets; wire it up once we're pulling DODAAC from the
  //    LamLinks awards download (next feature).
  const dodaacMissing: any[] = [];

  const nsnMissing: Record<string, { nsn: string; awards: any[] }> = {};
  const ready: any[] = [];
  for (const a of awards) {
    const nsn = `${a.fsc}-${a.niin}`;
    const info = nsnMap.get(nsn);
    if (!info) {
      // No fsc+niin on award row, skip silently
      continue;
    }
    if (foundNsns.has(info.digits)) {
      ready.push(a);
    } else {
      if (!nsnMissing[nsn]) nsnMissing[nsn] = { nsn, awards: [] };
      nsnMissing[nsn].awards.push(a);
    }
  }

  return NextResponse.json({
    ready,
    dodaac_missing: dodaacMissing,
    nsn_missing: Object.values(nsnMissing),
    checked: awards.length,
  });
}
