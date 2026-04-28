import "./env";
import { readFileSync } from "fs";
async function main() {
  const mgmtUrl = "https://api.supabase.com/v1/projects/jzgvdfzboknpcrhymjob/database/query";
  const mgmtToken = process.env.SUPABASE_MGMT_TOKEN || "sbp_v0_484815b13adb8ee0a78457e0a087b2cb6502bd91";
  const sql = readFileSync("scripts/sql/fix-invoice-queue-state-check.sql", "utf-8");
  const r = await fetch(mgmtUrl, { method: "POST", headers: { Authorization: `Bearer ${mgmtToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }) });
  console.log(r.status, await r.text());
}
main();
