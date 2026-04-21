import "./env";

async function main() {
  const mgmtToken = "sbp_v0_484815b13adb8ee0a78457e0a087b2cb6502bd91";
  const r = await fetch("https://api.supabase.com/v1/projects/jzgvdfzboknpcrhymjob/database/query", {
    method: "POST",
    headers: { Authorization: `Bearer ${mgmtToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'nsn_catalog' ORDER BY ordinal_position`,
    }),
  });
  console.log(await r.text());

  // Also sample a few rows
  const r2 = await fetch("https://api.supabase.com/v1/projects/jzgvdfzboknpcrhymjob/database/query", {
    method: "POST",
    headers: { Authorization: `Bearer ${mgmtToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `SELECT * FROM nsn_catalog WHERE nsn = '6509-01-578-7887' LIMIT 3`,
    }),
  });
  console.log(await r2.text());
}
main().catch(console.error);
