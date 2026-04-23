import { createServiceClient } from "@/lib/supabase-server";
import { ActivityFeed } from "./activity-feed";

export const dynamic = "force-dynamic";

async function getData() {
  const sb = createServiceClient();
  const since = new Date(Date.now() - 3 * 86_400_000).toISOString(); // last 3 days

  // Everything in parallel. Each source contributes its own "activity"
  // shape — we merge + sort in the client.
  const [bids, invoices, edi, shipments, syncs] = await Promise.all([
    sb
      .from("bid_decisions")
      .select("id, solicitation_number, nsn, status, updated_at, user_id, comment, override_price")
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(200),
    sb
      .from("invoice_state_events")
      .select("id, kad_id, invoice_number, from_state, to_state, event_type, upname, total, detected_at")
      .gte("detected_at", since)
      .order("detected_at", { ascending: false })
      .limit(200),
    sb
      .from("ll_edi_transmissions")
      .select("id, idnkbr, parent_table, parent_id, edi_type, lifecycle, status, transmitted_at, added_by")
      .gte("transmitted_at", since)
      .order("transmitted_at", { ascending: false })
      .limit(300),
    sb
      .from("ll_shipments")
      .select("id, idnkaj, ship_number, contract_number, nsn, description, quantity, sell_value, ship_status, ship_date")
      .gte("ship_date", since)
      .order("ship_date", { ascending: false })
      .limit(200),
    sb
      .from("sync_log")
      .select("id, action, details, created_at")
      .gte("created_at", since)
      .in("action", [
        "ll_edi_transmissions_sync",
        "ll_pod_records_sync",
        "ll_item_pids_sync",
        "shipping_sync",
        "invoice_state_sync",
      ])
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  return {
    bids: bids.data || [],
    invoices: invoices.data || [],
    edi: edi.data || [],
    shipments: shipments.data || [],
    syncs: syncs.data || [],
  };
}

export default async function ActivityPage() {
  const data = await getData();
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <ActivityFeed {...data} />
    </div>
  );
}
