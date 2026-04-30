import "./env";
import { readFileSync } from "fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const token = process.env.SUPABASE_MGMT_TOKEN || process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = url.replace("https://", "").split(".")[0];
const sql = readFileSync("scripts/sql/create-dibs-suppliers.sql", "utf8");

(async () => {
  if (!token) { console.log("no SUPABASE_MGMT_TOKEN; run the SQL manually in Supabase."); return; }
  const r = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  console.log("status:", r.status);
  console.log(await r.text());
})();
