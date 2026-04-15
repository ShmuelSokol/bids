import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * POST /api/webhooks/masterdb
 *
 * Receives NSN/mfr update events from Master DB so DIBS doesn't have
 * to repeat-poll /api/dibs/items/export?has_nsn=1 during every enrich
 * call. Expected payload (matches the spec we sent):
 *
 *   {
 *     event: "item.nsn_updated" | "item.mfr_updated" | "item.created",
 *     upc: string, sku: string | null,
 *     nsn: string | null,
 *     mfr_part_number: string | null,
 *     updated_at: ISO timestamp,
 *     changed_fields?: string[]
 *   }
 *
 * Auth: X-Webhook-Secret header must match MDB_WEBHOOK_SECRET env var.
 *
 * On receipt, we upsert a thin row into `mdb_item_events` so enrich
 * can check "has MDB seen this NSN recently?" without hitting MDB.
 * We intentionally do NOT fully denormalize the item; if enrich needs
 * the full payload it can GET /api/dibs/items?upc=X from MDB directly
 * (sub-second individual lookup per their guidance).
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  const expected = process.env.MDB_WEBHOOK_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }
  if (secret !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { event, upc, sku, nsn, mfr_part_number, updated_at, changed_fields } = body || {};
  if (!event || (!upc && !sku)) {
    return NextResponse.json({ error: "event + upc|sku required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const row = {
    event,
    upc: upc || null,
    sku: sku || null,
    nsn: nsn?.trim() || null,
    mfr_part_number: mfr_part_number?.trim() || null,
    changed_fields: changed_fields || [],
    source_updated_at: updated_at || new Date().toISOString(),
    received_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("mdb_item_events")
    .insert(row);

  if (error) {
    console.error("mdb_item_events insert failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
