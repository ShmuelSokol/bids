import "./env";
import { readFileSync } from "fs";
async function main() {
  const url = "https://api.supabase.com/v1/projects/jzgvdfzboknpcrhymjob/database/query";
  const token = "sbp_v0_484815b13adb8ee0a78457e0a087b2cb6502bd91";
  const sql = readFileSync("C:/tmp/alter-snapshot.sql", "utf-8");
  const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }) });
  console.log("HTTP", r.status, (await r.text()).slice(0, 300));
}
main();
