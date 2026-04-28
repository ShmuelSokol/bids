async function getCookies() {
  const DIBBS = "https://www.dibbs.bsm.dla.mil";
  const consent = await fetch(`${DIBBS}/dodwarning.aspx?goto=/`, { redirect: "manual" });
  const html = await consent.text();
  const initialCookies = (consent.headers.getSetCookie?.() || []).map((c: string) => c.split(";")[0]).join("; ");
  const fields: Record<string, string> = {};
  const re = /<input[^>]*type="hidden"[^>]*name="([^"]+)"[^>]*value="([^"]*)"/gi;
  let m; while ((m = re.exec(html)) !== null) fields[m[1]] = m[2];
  const params = new URLSearchParams(fields);
  params.append("butAgree", "OK");
  const post = await fetch(`${DIBBS}/dodwarning.aspx?goto=/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: initialCookies },
    body: params.toString(),
    redirect: "manual",
  });
  const postCookies = (post.headers.getSetCookie?.() || []).map((c: string) => c.split(";")[0]);
  return [...new Set([...initialCookies.split("; "), ...postCookies])].join("; ");
}

(async () => {
  const DIBBS = "https://www.dibbs.bsm.dla.mil";
  const sol = "SPE2DH-26-T-3287";
  const cleanSol = sol.replace(/-/g, "");
  const cookies = await getCookies();
  // Search results page — look for Package View link
  const r = await fetch(`${DIBBS}/Rfq/RfqRecs.aspx?category=SOL&value=${cleanSol}&scope=open`, { headers: { Cookie: cookies } });
  const html = await r.text();
  // Find Package View link
  const pkgMatch = html.match(/href="([^"]*Pkg[^"]*)"/i) || html.match(/href="([^"]*(?:Package|View|Detail)[^"]*)"/i);
  console.log("Package View href:", pkgMatch?.[1]);
  // Also look for RfqView URLs
  const rfqViews = html.match(/href="([^"]*Rfq[A-Z][^"]*)"/g);
  console.log("RFQ view URLs:", rfqViews?.slice(0, 5));
  // Extract URL params from aspx href
  const anyLinks = (html.match(/href="([^"]+\.aspx[^"]*)"/g) || []).slice(0, 10);
  console.log("first 10 aspx links:", anyLinks);
})();
