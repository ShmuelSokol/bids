import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * GET /api/dibbs/clins?sol=SPE2DS-26-T-021R
 *
 * Returns scraped CLINs from dibbs_sol_clins for one solicitation.
 * Modal uses this to display a "DIBBS says" panel and flag discrepancy
 * with LL's k11_tab data (LL often only captures the first CLIN).
 */
export async function GET(req: NextRequest) {
  const sol = req.nextUrl.searchParams.get("sol")?.trim().toUpperCase();
  if (!sol) return NextResponse.json({ error: "missing sol" }, { status: 400 });

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("dibbs_sol_clins")
    .select("clin_no, nsn, fsc, niin, qty, uom, scraped_at")
    .eq("sol_no", sol)
    .order("clin_no", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const clins = data || [];
  const totalQty = clins.reduce((sum, c) => sum + (c.qty || 0), 0);
  const lastScraped = clins[0]?.scraped_at ?? null;

  return NextResponse.json({
    sol,
    clin_count: clins.length,
    total_qty: totalQty,
    last_scraped_at: lastScraped,
    clins,
  });
}
