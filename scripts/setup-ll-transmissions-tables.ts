/**
 * Create ll_edi_transmissions + ll_pod_records tables in Supabase.
 * Runs the DDL in scripts/sql/ll-transmissions-schema.sql via the
 * Supabase management API.
 *
 * Follows the pattern from scripts/setup-system-settings.ts.
 *
 *   npx tsx scripts/setup-ll-transmissions-tables.ts
 */
import "./env";
import { readFileSync } from "fs";
import { join } from "path";

async function main() {
  const mgmtUrl = "https://api.supabase.com/v1/projects/jzgvdfzboknpcrhymjob/database/query";
  const mgmtToken =
    process.env.SUPABASE_MGMT_TOKEN ||
    "sbp_v0_484815b13adb8ee0a78457e0a087b2cb6502bd91"; // fallback, already hardcoded in sibling setup scripts

  const sql = readFileSync(join(__dirname, "sql", "ll-transmissions-schema.sql"), "utf-8");

  const resp = await fetch(mgmtUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${mgmtToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await resp.text();
  console.log(`HTTP ${resp.status}`);
  console.log(text.slice(0, 1000));

  if (!resp.ok) {
    process.exit(1);
  }
  console.log("\n✅ Tables created (or already existed)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
