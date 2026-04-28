import "./env";
async function main() {
  const r = await fetch("https://api.supabase.com/v1/projects/jzgvdfzboknpcrhymjob/database/query", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.SUPABASE_MGMT_TOKEN || "sbp_v0_484815b13adb8ee0a78457e0a087b2cb6502bd91"}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='lamlinks_invoice_queue' ORDER BY ordinal_position" }),
  });
  console.log(await r.text());
}
main();
