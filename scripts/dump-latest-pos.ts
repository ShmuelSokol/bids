import "./env";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: pos } = await sb
    .from("purchase_orders")
    .select("id, po_number, supplier, line_count, created_at")
    .order("created_at", { ascending: false })
    .limit(5);
  console.log(`Last 5 POs:\n`);
  for (const p of pos || []) {
    console.log(`${p.po_number}  supplier=${p.supplier}  lines=${p.line_count}  at=${p.created_at}`);
    const { data: lines } = await sb
      .from("po_lines")
      .select("award_id, nsn, supplier, cost_source, unit_cost")
      .eq("po_id", p.id);
    for (const l of lines || []) {
      console.log(`  award ${l.award_id}  NSN ${l.nsn}  unit_cost=${l.unit_cost}  src="${l.cost_source?.slice(0, 80)}"`);
    }
    console.log();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
