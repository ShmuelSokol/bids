import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";

/**
 * GET /api/invoicing/followups
 *
 * Two parallel sections:
 *
 * 1. Invoices posted but unpaid — Abe's leak on the government-pay
 *    side. Source: sync_log events where an invoice flipped to
 *    cinsta='Posted' + no remittance line against it yet.
 *    Heuristic: posted > 21 days = amber; > 30 days = red.
 *
 * 2. AX government POs via DD219 marker — Abe's leak on the vendor
 *    side. Query AX OData for PurchaseOrderLinesV2 where
 *    CustomerRequisitionNumber='DD219', group by PurchaseOrderNumber.
 *    These are Abe's purchase orders that should have been placed
 *    for government fulfillment. Surface ones whose PO has
 *    PurchaseOrderStatus='Backorder' (still open / unreceived).
 *
 * Both sections write directly to this endpoint's response — the
 * UI renders whatever comes back. No pagination yet (counts should
 * be manageable; add later if needed).
 */

async function getAxToken() {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.AX_CLIENT_ID!,
    client_secret: process.env.AX_CLIENT_SECRET!,
    scope: `${process.env.AX_D365_URL}/.default`,
  });
  const r = await fetch(
    `https://login.microsoftonline.com/${process.env.AX_TENANT_ID}/oauth2/v2.0/token`,
    { method: "POST", body: params }
  );
  const d: any = await r.json();
  if (!d.access_token) throw new Error("AX auth failed");
  return d.access_token;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const supabase = createServiceClient();

  // ---- Section 1: posted invoices awaiting payment ----
  // Use the invoice_state_events trail. For each kad_id whose most
  // recent event is to_state='Posted', compute days since posted.
  // Amber: 21-30d. Red: >30d.
  const allEvents: any[] = [];
  for (let p = 0; p < 10; p++) {
    const { data } = await supabase
      .from("invoice_state_events")
      .select("kad_id, invoice_number, to_state, detected_at, total, upname")
      .order("detected_at", { ascending: false })
      .range(p * 1000, (p + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allEvents.push(...data);
    if (data.length < 1000) break;
  }
  const latestByKad = new Map<number, any>();
  for (const e of allEvents) {
    if (!latestByKad.has(e.kad_id)) latestByKad.set(e.kad_id, e);
  }
  const now = Date.now();
  const postedInvoices: any[] = [];
  for (const [kad_id, e] of latestByKad) {
    if (e.to_state?.trim() === "Posted") {
      const daysPosted = Math.floor((now - new Date(e.detected_at).getTime()) / 86_400_000);
      if (daysPosted >= 21) {
        postedInvoices.push({
          kad_id,
          invoice_number: e.invoice_number,
          total: e.total,
          posted_on: e.detected_at,
          days_overdue: daysPosted - 30,
          days_since_posted: daysPosted,
          severity: daysPosted > 30 ? "red" : "amber",
          upname: e.upname,
        });
      }
    }
  }
  postedInvoices.sort((a, b) => b.days_since_posted - a.days_since_posted);

  // ---- Section 2: AX government POs (DD219-marked) ----
  let axPos: any[] = [];
  let axError: string | null = null;
  try {
    const token = await getAxToken();
    const D = process.env.AX_D365_URL!;
    // Pull lines marked with DD219 customer requisition, group by PO.
    // Filter to Backorder status so we see open/unreceived only.
    // Case-insensitive match — observed 'DD219' + 'dd219' variants in
    // a 1000-row sample; toupper() catches both.
    const url = `${D}/data/PurchaseOrderLinesV2?cross-company=true&$filter=toupper(CustomerRequisitionNumber) eq 'DD219' and PurchaseOrderLineStatus eq 'Backorder'&$select=PurchaseOrderNumber,LineNumber,ItemNumber,LineDescription,OrderedPurchaseQuantity,PurchasePrice,RequestedDeliveryDate,ConfirmedDeliveryDate,PurchaseOrderLineStatus&$top=1000`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) {
      axError = `AX HTTP ${r.status}`;
    } else {
      const d: any = await r.json();
      const byPO: Record<string, any> = {};
      for (const line of d.value || []) {
        const pn = line.PurchaseOrderNumber;
        if (!byPO[pn]) {
          byPO[pn] = {
            po_number: pn,
            line_count: 0,
            total: 0,
            earliest_delivery: null as string | null,
            lines: [] as any[],
          };
        }
        byPO[pn].line_count++;
        byPO[pn].total += (line.PurchasePrice || 0) * (line.OrderedPurchaseQuantity || 0);
        const reqDelivery = line.RequestedDeliveryDate;
        if (reqDelivery && reqDelivery !== "1900-01-01T12:00:00Z") {
          if (!byPO[pn].earliest_delivery || reqDelivery < byPO[pn].earliest_delivery) {
            byPO[pn].earliest_delivery = reqDelivery;
          }
        }
        byPO[pn].lines.push(line);
      }
      axPos = Object.values(byPO).sort((a: any, b: any) => {
        if (!a.earliest_delivery) return 1;
        if (!b.earliest_delivery) return -1;
        return a.earliest_delivery.localeCompare(b.earliest_delivery);
      });
    }
  } catch (e: any) {
    axError = e?.message || "AX lookup failed";
  }

  // ---- Section 3: award ↔ PO linkage status ----
  // Pull recent 0AG09 awards + join to po_award_links.
  // Bucket: no PO, PO backorder, PO received.
  const sinceIso = new Date(Date.now() - 180 * 86_400_000).toISOString();
  const awardsRows: any[] = [];
  for (let p = 0; p < 20; p++) {
    const { data } = await supabase
      .from("awards")
      .select("id, contract_number, fsc, niin, unit_price, quantity, award_date, description, ship_status")
      .eq("cage", "0AG09")
      .gte("award_date", sinceIso)
      .order("award_date", { ascending: false })
      .range(p * 1000, (p + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    awardsRows.push(...data);
    if (data.length < 1000) break;
  }
  const awardIds = awardsRows.map((a) => a.id);
  const linksByAward = new Map<number, any[]>();
  for (let i = 0; i < awardIds.length; i += 500) {
    const chunk = awardIds.slice(i, i + 500);
    const { data } = await supabase.from("po_award_links").select("*").in("award_id", chunk);
    for (const l of data || []) {
      if (!linksByAward.has(l.award_id)) linksByAward.set(l.award_id, []);
      linksByAward.get(l.award_id)!.push(l);
    }
  }
  // Bucketing rules (per Abe 2026-04-16):
  //   - Shipped to DLA (ship_status='Shipped' or similar) → done,
  //     regardless of PO state. Some items ship from stock → no PO.
  //   - Not shipped + no PO → needs attention (stock check or create PO)
  //   - Not shipped + PO in backorder → vendor follow-up
  //   - Not shipped + PO received → ready to ship, no chase needed
  function isShipped(s: string | null): boolean {
    if (!s) return false;
    const v = s.trim().toLowerCase();
    return v === "shipped" || v === "invoiced" || v === "complete";
  }
  const awardsShipped: any[] = [];
  const awardsNoPo: any[] = [];
  const awardsBackorder: any[] = [];
  const awardsReceivedPending: any[] = [];
  for (const a of awardsRows) {
    const links = linksByAward.get(a.id) || [];
    if (isShipped(a.ship_status)) {
      awardsShipped.push({ ...a, links });
      continue;
    }
    if (links.length === 0) {
      awardsNoPo.push({ ...a, links: [] });
    } else {
      const allReceived = links.every((l) => (l.po_line_status || "").trim() === "Received");
      if (allReceived) awardsReceivedPending.push({ ...a, links });
      else awardsBackorder.push({ ...a, links });
    }
  }

  return NextResponse.json({
    posted_invoices: postedInvoices,
    posted_invoices_count: postedInvoices.length,
    posted_amber: postedInvoices.filter((p) => p.severity === "amber").length,
    posted_red: postedInvoices.filter((p) => p.severity === "red").length,
    ax_government_pos: axPos,
    ax_po_count: axPos.length,
    ax_error: axError,
    // award↔PO buckets (shipped awards excluded from action buckets)
    awards_total: awardsRows.length,
    awards_shipped_count: awardsShipped.length,
    awards_no_po: awardsNoPo,
    awards_backorder: awardsBackorder,
    awards_received_pending_count: awardsReceivedPending.length,
  });
}
