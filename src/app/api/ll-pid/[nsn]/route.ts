import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * GET /api/ll-pid/:nsn  — returns the most recent Procurement Item Description
 * and Contract Packaging Requirements for an NSN, sourced from LL's kah_tab
 * via the ll_item_pids cache table.
 *
 * NSN format accepted: "FSC-NIIN" (e.g. "6515-01-234-5678"), "FSCNIIN" (no
 * dashes), or ":fsc/:niin" split path — we normalize.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ nsn: string }> }
) {
  const { nsn: raw } = await params;
  const clean = decodeURIComponent(raw).replace(/[^A-Za-z0-9]/g, "");
  if (clean.length < 9) {
    return NextResponse.json({ error: "NSN must be at least 9 digits" }, { status: 400 });
  }
  const fsc = clean.slice(0, 4);
  const niin = clean.slice(4).replace(/^0+/, "") || clean.slice(4); // tolerate with/without leading zeros
  // Try both: exact niin AND full 9-digit niin (FSC gives us 4 of 13)
  const niinNormalized = clean.slice(4);

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("ll_item_pids")
    .select("fsc, niin, pid_text, packaging_text, packaging_notes, last_award_date, source_idnk81, pid_bytes, synced_at")
    .eq("fsc", fsc)
    .in("niin", [niinNormalized, niin])
    .order("last_award_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ found: false, nsn: `${fsc}-${niinNormalized}` });
  }
  return NextResponse.json({ found: true, ...data });
}
