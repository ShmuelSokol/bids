import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";

/**
 * POST /api/orders/poll-ax
 *
 * For each purchase_orders row in state 'awaiting_po_number' or
 * 'awaiting_lines_import', queries AX OData to detect whether the
 * expected row has landed yet. On match:
 *   - awaiting_po_number  → stamps ax_po_number, flips to 'lines_ready'
 *   - awaiting_lines_import → verifies line count, flips to 'posted'
 *
 * Body (optional): { poIds?: number[] } to scope. Omit to poll all
 * active rows.
 *
 * Caller is the dispatcher (Windows scheduled task, every 5 min) or
 * the /orders UI's refresh button.
 */

async function getToken() {
  const TENANT_ID = process.env.AX_TENANT_ID!;
  const CLIENT_ID = process.env.AX_CLIENT_ID!;
  const CLIENT_SECRET = process.env.AX_CLIENT_SECRET!;
  const D365_URL = process.env.AX_D365_URL!;
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: `${D365_URL}/.default`,
  });
  const r = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    { method: "POST", body: params }
  );
  const d: any = await r.json();
  if (!d.access_token) throw new Error("AX auth failed: " + d.error_description);
  return d.access_token;
}

export async function POST(req: NextRequest) {
  // Allow the scheduled task dispatcher (Windows) to hit this route
  // without a session cookie by presenting X-Internal-Secret.
  // getCurrentUser() is still the path for browser-triggered polls.
  const internalSecret = req.headers.get("x-internal-secret");
  const expected = process.env.INTERNAL_POLL_SECRET;
  const authedViaSecret = expected && internalSecret === expected;
  const user = authedViaSecret ? null : await getCurrentUser();
  if (!authedViaSecret && !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const body = await req.json().catch(() => ({}));

  const active = supabase
    .from("purchase_orders")
    .select("id, po_number, supplier, ax_po_number, ax_correlation_ref, dmf_state, po_lines(id)")
    .in("dmf_state", ["awaiting_po_number", "awaiting_lines_import"]);
  const { data: pos, error } = body.poIds
    ? await active.in("id", body.poIds)
    : await active;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!pos?.length) return NextResponse.json({ checked: 0, updated: 0, pos: [] });

  const D365_URL = process.env.AX_D365_URL!;
  const token = await getToken();
  const updates: any[] = [];
  const now = new Date().toISOString();

  for (const po of pos) {
    try {
      if (po.dmf_state === "awaiting_po_number") {
        // Find the AX header that carries our correlation tag.
        // Candidate correlation fields: VendorOrderReference (free
        // text, always shown in sample) or PurchaseOrderName.
        const filter = encodeURIComponent(
          `VendorOrderReference eq '${po.ax_correlation_ref}'`
        );
        const url = `${D365_URL}/data/PurchaseOrderHeadersV2?cross-company=true&$filter=${filter}&$top=1&$select=PurchaseOrderNumber`;
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) {
          updates.push({ id: po.id, dmf_error: `poll header ${r.status}` });
          continue;
        }
        const d: any = await r.json();
        const hit = d.value?.[0]?.PurchaseOrderNumber;
        if (hit) {
          await supabase
            .from("purchase_orders")
            .update({
              ax_po_number: hit,
              dmf_state: "lines_ready",
              dmf_last_polled_at: now,
              dmf_error: null,
            })
            .eq("id", po.id);
          updates.push({ id: po.id, from: "awaiting_po_number", to: "lines_ready", ax_po_number: hit });
        } else {
          await supabase
            .from("purchase_orders")
            .update({ dmf_last_polled_at: now })
            .eq("id", po.id);
        }
      } else if (po.dmf_state === "awaiting_lines_import") {
        if (!po.ax_po_number) continue;
        const filter = encodeURIComponent(
          `PurchaseOrderNumber eq '${po.ax_po_number}'`
        );
        const url = `${D365_URL}/data/PurchaseOrderLinesV2?cross-company=true&$filter=${filter}&$select=LineNumber`;
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) {
          updates.push({ id: po.id, dmf_error: `poll lines ${r.status}` });
          continue;
        }
        const d: any = await r.json();
        const gotLines = d.value?.length || 0;
        const expectedLines = po.po_lines?.length || 0;
        if (gotLines >= expectedLines && expectedLines > 0) {
          await supabase
            .from("purchase_orders")
            .update({
              dmf_state: "posted",
              dmf_last_polled_at: now,
              dmf_error: null,
            })
            .eq("id", po.id);
          updates.push({ id: po.id, from: "awaiting_lines_import", to: "posted", line_count: gotLines });
        } else {
          await supabase
            .from("purchase_orders")
            .update({ dmf_last_polled_at: now })
            .eq("id", po.id);
        }
      }
    } catch (e: any) {
      updates.push({ id: po.id, error: e?.message || "unknown" });
    }
  }

  return NextResponse.json({ checked: pos.length, updated: updates.length, pos: updates });
}
