import { createServiceClient } from "@/lib/supabase-server";
import { ShippingDashboard } from "./shipping-dashboard";

async function getData() {
  const supabase = createServiceClient();

  // DPMS pending counts — stale/untouched DPMS scenarios across the whole
  // transmission history. These never self-resolve; someone has to act.
  const { count: dpmsPending } = await supabase
    .from("ll_edi_transmissions")
    .select("id", { count: "exact", head: true })
    .eq("edi_type", "DPMS")
    .in("lifecycle", ["sent", "not_sent", "other"]);

  // Stale WAWF 810 — sent > 30 days ago, no ack (LL doesn't record acks,
  // but a long-aging 810 with no payment landing is the actionable signal).
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { count: staleWawf } = await supabase
    .from("ll_edi_transmissions")
    .select("id", { count: "exact", head: true })
    .eq("edi_type", "810")
    .eq("lifecycle", "sent")
    .lt("transmitted_at", thirtyDaysAgo);

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
    dpmsPending: dpmsPending ?? 0,
    staleWawf: staleWawf ?? 0,
  };
}

export default async function ShippingPage() {
  const { shipments, lastSync, lastEdiSync, dpmsPending, staleWawf } = await getData();

  return (
    <div className="p-4 md:p-8">
      <ShippingDashboard
        shipments={shipments}
        lastSync={lastSync}
        lastEdiSync={lastEdiSync}
        dpmsPending={dpmsPending}
        staleWawf={staleWawf}
      />
    </div>
  );
}
