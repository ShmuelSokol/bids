import { createServiceClient } from "@/lib/supabase-server";
import { ShippingDashboard } from "./shipping-dashboard";

async function getData() {
  const supabase = createServiceClient();

  // Load shipments with WAWF/EDI status joined (ll_shipments_with_edi view).
  // The view adds wawf_810_status, wawf_856_status, wawf_*_at, edi_health
  // via LATERAL join on ll_edi_transmissions where parent_table='kaj'.
  const { data: shipments } = await supabase
    .from("ll_shipments_with_edi")
    .select("*")
    .order("ship_date", { ascending: false })
    .limit(500);

  // Last sync times — both shipping (kaj) and EDI (kbr)
  const [{ data: lastShipSync }, { data: lastEdiSync }] = await Promise.all([
    supabase
      .from("sync_log")
      .select("created_at")
      .eq("action", "shipping_sync")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("sync_log")
      .select("created_at")
      .eq("action", "ll_edi_transmissions_sync")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    shipments: shipments || [],
    lastSync: lastShipSync?.created_at || null,
    lastEdiSync: lastEdiSync?.created_at || null,
  };
}

export default async function ShippingPage() {
  const { shipments, lastSync, lastEdiSync } = await getData();

  return (
    <div className="p-4 md:p-8">
      <ShippingDashboard shipments={shipments} lastSync={lastSync} lastEdiSync={lastEdiSync} />
    </div>
  );
}
