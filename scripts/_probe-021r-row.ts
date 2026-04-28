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
  const url = `${DIBBS}/Rfq/RfqRecs.aspx?category=SOL&value=${cleanSol}&scope=open`;
  const r = await fetch(url, { headers: { Cookie: cookies } });
  const html = await r.text();

  // Find the table containing the sol
  const solIdx = html.indexOf(cleanSol);
  if (solIdx < 0) { console.log("not found"); return; }

  // Walk back to find the enclosing <tr> and extract row links
  let tableStart = html.lastIndexOf("<tr", solIdx);
  let tableEnd = html.indexOf("</tr>", solIdx) + 5;
  const row = html.slice(tableStart, tableEnd);
  console.log("--- sol row HTML (compressed) ---");
  console.log(row.replace(/\s+/g, " "));
})();
