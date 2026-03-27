import { NextRequest, NextResponse } from "next/server";

const DIBBS_BASE = "https://www.dibbs.bsm.dla.mil";

/** Helper: accept DIBBS consent and return session cookies */
async function getDibbsCookies(): Promise<string> {
  // GET consent page for session cookies + ASP.NET __VIEWSTATE
  const consentPage = await fetch(`${DIBBS_BASE}/dodwarning.aspx?goto=/`, { redirect: "manual" });
  const consentHtml = await consentPage.text();

  const getCookies = consentPage.headers.getSetCookie?.() || [];
  const initialCookies = getCookies.map(c => c.split(";")[0]).join("; ");

  // Extract hidden form fields
  const fields: Record<string, string> = {};
  const re = /<input[^>]*type="hidden"[^>]*name="([^"]+)"[^>]*value="([^"]*)"/gi;
  let m;
  while ((m = re.exec(consentHtml)) !== null) fields[m[1]] = m[2];

  // POST consent — redirect:"manual" to capture the `dw` consent cookie
  const params = new URLSearchParams(fields);
  params.append("butAgree", "OK");

  const postResp = await fetch(`${DIBBS_BASE}/dodwarning.aspx?goto=/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: initialCookies },
    body: params.toString(),
    redirect: "manual",
  });

  // Merge all cookies
  const postCookies = postResp.headers.getSetCookie?.() || [];
  const merged = new Map<string, string>();
  for (const c of [...getCookies, ...postCookies]) {
    const [kv] = c.split(";");
    const [k] = kv.split("=");
    if (kv.includes("=") && !kv.endsWith("=")) merged.set(k.trim(), kv);
  }
  return [...merged.values()].join("; ");
}

/**
 * GET /api/dibbs/check-open?sol=SPE2DS-26-T-7639
 * Checks if a solicitation is still open on DIBBS.
 */
export async function GET(req: NextRequest) {
  const sol = req.nextUrl.searchParams.get("sol");
  if (!sol) return NextResponse.json({ error: "sol required" }, { status: 400 });

  try {
    const cookies = await getDibbsCookies();
    const cleanSol = sol.replace(/-/g, "");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const resp = await fetch(
        `${DIBBS_BASE}/Rfq/RfqRecs.aspx?category=SOL&value=${cleanSol}&scope=open`,
        { redirect: "follow", signal: controller.signal, headers: { Cookie: cookies } }
      );
      const html = await resp.text();

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
