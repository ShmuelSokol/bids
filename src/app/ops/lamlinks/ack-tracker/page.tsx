import { redirect } from "next/navigation";
import { createServiceClient, getCurrentUser, hasAdminAccess } from "@/lib/supabase-server";
import { AckTrackerDashboard } from "./ack-tracker-dashboard";

export const dynamic = "force-dynamic";

/**
 * WAWF 810 Ack Tracker — inferred acknowledgment status for every
 * invoice we've transmitted to DLA.
 *
 * Why this exists: LL never records WAWF acks (verified — 513K
 * transmissions ever, zero with "acknowledged" status). DLA's actual
 * responses land via email / WAWF portal that nobody auto-imports.
 * Real rejections are typically discovered 30-40 days after-the-fact
 * via AR aging, which is expensive in delayed cash flow.
 *
 * This page synthesizes aging status from just the transmitted-at
 * timestamp: as time passes without payment, the "probable rejection"
 * likelihood goes up. Phase 1 — age-only. Phase 2 (future) will layer
 * in AX CustTrans payment data to mark definite "paid" / "not paid".
 */

async function getData() {
  const sb = createServiceClient();
  // Default window: 60 days. An 810 sent 60+ days ago with no payment is
  // either (a) definitely-stuck (would already have surfaced in AR aging),
  // or (b) actually paid but we don't have the payment signal yet. Either
  // way, it's not the most actionable for TODAY. Keep the window tight.
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString();

  // Pull every WAWF 810 from the last 60 days — paginate to avoid the 1K cap
  const transmissions: any[] = [];
  for (let page = 0; page < 10; page++) {
    const { data } = await sb
      .from("ll_edi_transmissions")
      .select("id, idnkbr, parent_table, parent_id, edi_type, lifecycle, status, transmitted_at, added_by, scenario")
      .eq("edi_type", "810")
      .gte("transmitted_at", since)
      .order("transmitted_at", { ascending: true })
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    transmissions.push(...data);
    if (data.length < 1000) break;
  }

  // Join to kaj-level shipments (one row per shipment, high coverage)
  const kajIds = Array.from(
    new Set(
      transmissions
        .filter((t) => t.parent_table === "kaj")
        .map((t) => t.parent_id)
        .filter((v): v is number => v != null)
    )
  );

  const shipmentsByKaj = new Map<number, any>();
  if (kajIds.length > 0) {
    for (let i = 0; i < kajIds.length; i += 500) {
      const chunk = kajIds.slice(i, i + 500);
      const { data } = await sb
        .from("ll_shipments_by_kaj")
        .select("idnkaj, ship_number, contract_number, first_nsn, first_description, total_quantity, total_value, ship_status, ship_date, clin_count")
        .in("idnkaj", chunk);
      for (const s of data || []) {
        if (s.idnkaj != null) {
          // Normalize field names to match the UI's Shipment interface
          shipmentsByKaj.set(Number(s.idnkaj), {
            idnkaj: s.idnkaj,
            ship_number: s.ship_number,
            contract_number: s.contract_number,
            nsn: s.first_nsn,
            description: s.first_description,
            quantity: s.total_quantity,
            sell_value: s.total_value,
            ship_status: s.ship_status,
            ship_date: s.ship_date,
            clin_count: s.clin_count,
          });
        }
      }
    }
  }

  // PHASE 2: AX DLA payment data — gives us the authoritative list of
  // (1) unsettled DLA invoices (DLA hasn't paid yet) and (2) recent
  // settlements (DLA just paid these). Lets Yosef cross-reference aging
  // 810s with what's actually been paid.
  const [{ data: unsettled }, { data: recentSettled }, paymentsLastSync] = await Promise.all([
    sb
      .from("ax_dla_payments")
      .select("ax_voucher, marked_invoice, marked_invoice_normalized, payment_date, payment_amount, payment_reference")
      .is("payment_amount", null)
      .order("payment_date", { ascending: true })
      .limit(500),
    sb
      .from("ax_dla_payments")
      .select("ax_voucher, marked_invoice, marked_invoice_normalized, payment_date, payment_amount, payment_reference")
      .not("payment_amount", "is", null)
      .gte("payment_date", new Date(Date.now() - 14 * 86_400_000).toISOString())
      .order("payment_date", { ascending: false })
      .limit(200),
    sb
      .from("sync_log")
      .select("created_at, details")
      .eq("action", "ax_dla_payments_sync")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const { data: lastSync } = await sb
    .from("sync_log")
    .select("created_at")
    .eq("action", "ll_edi_transmissions_sync")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    transmissions: transmissions || [],
    shipmentsByKaj: Object.fromEntries(shipmentsByKaj),
    lastSync: lastSync?.created_at || null,
    unsettledDlaInvoices: unsettled || [],
    recentDlaSettlements: recentSettled || [],
    axPaymentsSync: paymentsLastSync.data || null,
  };
}

export default async function AckTrackerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasAdminAccess(user.profile?.role)) redirect("/settings");

  const data = await getData();
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <AckTrackerDashboard
        transmissions={data.transmissions}
        shipmentsByKaj={data.shipmentsByKaj}
        lastSync={data.lastSync}
        unsettledDlaInvoices={data.unsettledDlaInvoices}
        recentDlaSettlements={data.recentDlaSettlements}
        axPaymentsSync={data.axPaymentsSync}
      />
    </div>
  );
}
