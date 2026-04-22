import "./env";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { count: poCount } = await sb.from("purchase_orders").select("id", { count: "exact", head: true });
  console.log(`Total rows in purchase_orders: ${poCount}`);

  const { count: lineCount } = await sb.from("po_lines").select("id", { count: "exact", head: true });
  console.log(`Total rows in po_lines: ${lineCount}`);

  const { data: recent } = await sb
    .from("purchase_orders")
    .select("id, po_number, supplier, line_count, total_cost, created_at, created_by")
    .order("id", { ascending: false })
    .limit(5);
  console.log(`\nMost recent 5 POs (by id desc):`);
  for (const p of recent || []) console.log(`  ${JSON.stringify(p)}`);

  // Also awards with po_generated=true recently
  const { data: recentAwards } = await sb
    .from("awards")
    .select("id, contract_number, po_generated, po_id")
    .eq("po_generated", true)
    .order("id", { ascending: false })
    .limit(5);
  console.log(`\nMost recent 5 awards flagged po_generated=true:`);
  for (const a of recentAwards || []) console.log(`  ${JSON.stringify(a)}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
