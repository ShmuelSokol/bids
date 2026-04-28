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
  const sol = "SPE2DS-26-T-021R";
  const cleanSol = sol.replace(/-/g, "");
  const cookies = await getCookies();
  // Try direct RFQ Recs URL
  const url = `${DIBBS}/Rfq/RfqRecs.aspx?category=SOL&value=${cleanSol}&scope=open`;
  const r = await fetch(url, { headers: { Cookie: cookies } });
  const html = await r.text();
  console.log("status:", r.status, "bytes:", html.length);

  // Find any links related to this sol
  const solIdx = html.indexOf(cleanSol);
  if (solIdx < 0) { console.log("sol not in HTML — search may need scope=all"); }
  // Look for hyperlinks near the sol number
  const surround = solIdx > 0 ? html.slice(Math.max(0, solIdx - 500), solIdx + 1500) : "";
  console.log("--- context around sol ---");
  console.log(surround.replace(/\s+/g, " ").slice(0, 2000));
})();
