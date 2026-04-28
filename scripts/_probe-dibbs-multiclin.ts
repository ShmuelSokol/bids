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
  const r = await fetch(`${DIBBS}/Rfq/RfqRecs.aspx?category=SOL&value=${cleanSol}&scope=open`, { headers: { Cookie: cookies } });
  const html = await r.text();
  console.log("status:", r.status, "bytes:", html.length);
  // Count rows that mention the sol
  const rows = html.match(new RegExp(cleanSol, "gi")) || [];
  console.log("sol mentions in HTML:", rows.length);
  // Look for CLIN indicators — usually appears as "CLIN" or "Ln" or row data
  const tableStart = html.indexOf("RfqRecs") > -1 ? html.indexOf("<table", html.indexOf("RfqRecs")) : -1;
  if (tableStart > 0) {
    const tableEnd = html.indexOf("</table>", tableStart) + 8;
    const table = html.slice(tableStart, tableEnd);
    const trs = table.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    console.log("table rows:", trs.length);
    // Dump first 5 rows
    for (const [i, tr] of trs.slice(0, 10).entries()) {
      const stripped = tr.replace(/<[^>]+>/g, " | ").replace(/\s+/g, " ").trim();
      console.log(`  row ${i}: ${stripped.slice(0, 300)}`);
    }
  } else {
    console.log("no result table found");
    console.log("first 2000 bytes:", html.slice(0, 2000));
  }
})();
