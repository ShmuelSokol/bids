import { NextRequest, NextResponse } from "next/server";

const DIBBS_BASE = "https://www.dibbs.bsm.dla.mil";

/**
 * GET /api/dibbs/check-open?sol=SPE2DS-26-T-7639
 * Checks if a solicitation is still open on DIBBS.
 */
export async function GET(req: NextRequest) {
  const sol = req.nextUrl.searchParams.get("sol");
  if (!sol) return NextResponse.json({ error: "sol required" }, { status: 400 });

  try {
    // Accept consent
    await fetch(`${DIBBS_BASE}/dodwarning.aspx?goto=/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "butAgree=OK",
      redirect: "follow",
    });

    // Search for the solicitation
    const cleanSol = sol.replace(/-/g, "");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const resp = await fetch(
        `${DIBBS_BASE}/Rfq/RfqRecs.aspx?category=SOL&value=${cleanSol}&scope=open`,
        { redirect: "follow", signal: controller.signal }
      );
      const html = await resp.text();

      // Check if solicitation appears in results
      const isOpen = html.includes(sol) || html.includes(cleanSol) || html.includes("SPE");
      const hasResults = html.includes("<tr") && html.includes("SPE");

      return NextResponse.json({
        solicitation: sol,
        is_open: hasResults,
        checked_at: new Date().toISOString(),
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err: any) {
    return NextResponse.json({ solicitation: sol, is_open: null, error: err.message });
  }
}
