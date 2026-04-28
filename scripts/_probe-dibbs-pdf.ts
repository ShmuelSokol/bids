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
  const cleanSol = "SPE2DH26T3287";
  const cookies = await getCookies();
  const r = await fetch(`${DIBBS}/Rfq/RfqRecs.aspx?category=SOL&value=${cleanSol}&scope=open`, { headers: { Cookie: cookies } });
  const html = await r.text();
  // Look for PDF links (these point to the full RFQ document w/ CLINs)
  const pdfs = html.match(/href="([^"]+\.PDF)"/gi) || html.match(/href="([^"]+\.pdf)"/gi) || [];
  console.log("pdf links:", pdfs.slice(0, 5));
  // Look for dibbs2 downloads
  const d2 = html.match(/href="([^"]*dibbs2[^"]+)"/gi) || [];
  console.log("dibbs2 links:", d2.slice(0, 5));
  // Look for any direct download links
  const downloads = html.match(/href="([^"]*(?:Download|Doc)[^"]*)"/gi) || [];
  console.log("downloads:", downloads.slice(0, 5));
})();
