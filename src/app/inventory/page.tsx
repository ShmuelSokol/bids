import { createServiceClient } from "@/lib/supabase-server";
import { InventoryTable } from "./inventory-table";

export const dynamic = "force-dynamic";

async function getData() {
  const sb = createServiceClient();

  // Paginate the on-hand list (up to 25K rows)
  const items: any[] = [];
  for (let page = 0; page < 30; page++) {
    const { data } = await sb
      .from("ll_inventory_on_hand")
      .select("*")
      .order("qty_on_hand", { ascending: false })
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    items.push(...data);
    if (data.length < 1000) break;
  }

  const { data: lastSync } = await sb
    .from("sync_log")
    .select("created_at, details")
    .eq("action", "ll_inventory_sync")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    items,
    lastSync: lastSync?.created_at || null,
    summary: lastSync?.details || null,
  };
}

export default async function InventoryPage() {
  const { items, lastSync, summary } = await getData();
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <InventoryTable items={items} lastSync={lastSync} summary={summary} />
    </div>
  );
}
