import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";

/**
 * GET /api/orders/followups
 *   Returns POs that are past their SLA and need a follow-up email.
 *   Row shape: { po_id, po_number, supplier, days_overdue, sla_days,
 *                ax_po_number, total_cost, line_count, last_followup_at }
 *
 * POST /api/orders/followups
 *   Marks a PO as "followed up" (stamps last_followup_at).
 *   Body: { poId: number }
 *
 * PUT /api/orders/followups/rules
 *   Upsert a supplier SLA rule. Body: { vendor, sla_days, email_template? }
 */

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const supabase = createServiceClient();
  const [rulesRes, posRes] = await Promise.all([
    supabase.from("supplier_followup_rules").select("vendor, sla_days"),
    supabase
      .from("purchase_orders")
      .select("id, po_number, ax_po_number, supplier, total_cost, line_count, dmf_state, created_at, last_followup_at")
      .in("dmf_state", ["posted", "awaiting_lines_import"])
      .is("last_followup_at", null), // haven't nudged yet
  ]);
  const rules = new Map<string, number>();
  for (const r of rulesRes.data || []) rules.set(r.vendor, r.sla_days);
  const defaultSla = 7;

  const now = Date.now();
  const overdue = (posRes.data || [])
    .map((p: any) => {
      const sla = rules.get(p.supplier) ?? defaultSla;
      const ageDays = (now - new Date(p.created_at).getTime()) / 86_400_000;
      return { ...p, sla_days: sla, days_overdue: Math.floor(ageDays - sla) };
    })
    .filter((p: any) => p.days_overdue > 0)
    .sort((a: any, b: any) => b.days_overdue - a.days_overdue);

  return NextResponse.json({ overdue, default_sla: defaultSla });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const supabase = createServiceClient();
  const { poId } = await req.json();
  if (!poId) return NextResponse.json({ error: "poId required" }, { status: 400 });

  const { error } = await supabase
    .from("purchase_orders")
    .update({ last_followup_at: new Date().toISOString() })
    .eq("id", poId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
