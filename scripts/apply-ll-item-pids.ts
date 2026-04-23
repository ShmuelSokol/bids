/**
 * Create ll_item_pids table.
 *   npx tsx scripts/apply-ll-item-pids.ts
 */
import "./env";
import { readFileSync } from "fs";
import { join } from "path";

async function main() {
  const mgmtUrl = "https://api.supabase.com/v1/projects/jzgvdfzboknpcrhymjob/database/query";
  const mgmtToken =
    process.env.SUPABASE_MGMT_TOKEN ||
    "sbp_v0_484815b13adb8ee0a78457e0a087b2cb6502bd91";

  const sql = readFileSync(join(__dirname, "sql", "ll-item-pids-schema.sql"), "utf-8");
  const resp = await fetch(mgmtUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${mgmtToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  console.log(`HTTP ${resp.status}`);
  console.log((await resp.text()).slice(0, 500));
  if (!resp.ok) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
