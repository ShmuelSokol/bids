import { createServiceClient } from "@/lib/supabase-server";
import { ShippingDashboard } from "./shipping-dashboard";

async function getData() {
  const supabase = createServiceClient();

  // Load shipments from LamLinks sync
  const { data: shipments } = await supabase
    .from("ll_shipments")
    .select("*")
    .order("ship_date", { ascending: false })
    .limit(500);

  // Last sync time
  const { data: lastSync } = await supabase
    .from("sync_log")
    .select("created_at")
    .eq("action", "shipping_sync")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return {
    shipments: shipments || [],
    lastSync: lastSync?.created_at || null,
  };
}

export default async function ShippingPage() {
  const { shipments, lastSync } = await getData();

  return (
    <div className="p-4 md:p-8">
      <ShippingDashboard shipments={shipments} lastSync={lastSync} />
    </div>
  );
}
