import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser, hasAdminAccess } from "@/lib/supabase-server";
import { trackEvent, requestContext } from "@/lib/track";

/**
 * POST /api/bids/quote-batch
 *
 * Quote multiple sourceable items in one round-trip. For each pair,
 * the price defaults to the sourceable item's `suggested_price`, but
 * the caller can override per-pair.
 *
 * Each item is validated server-side: must be sourceable, not already
 * bid, no existing decision (or owned by the same user / admin).
 *
 * Body: {
 *   pairs: Array<{
 *     solicitation_number: string;
 *     nsn: string;
 *     final_price?: number;     // overrides suggested_price if provided
 *     lead_time_days?: number;  // default 45
 *     comment?: string;
 *   }>
 * }
 *
 * Returns: { quoted_count, skipped_count, skipped }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.profile?.must_reset_password) {
    return NextResponse.json({ error: "Password reset required" }, { status: 403 });
  }

  const body = await req.json();
  const pairs: Array<{
    solicitation_number: string;
    nsn: string;
    final_price?: number;
    lead_time_days?: number;
    comment?: string;
  }> = body?.pairs || [];

  if (!Array.isArray(pairs) || pairs.length === 0) {
    return NextResponse.json(
      { error: "pairs[] required" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const decidedBy = user.profile?.full_name || user.user.email || "unknown";
  const isAdmin = hasAdminAccess(user.profile?.role);

  // Pull every targeted solicitation in one round-trip so we can
  // validate (sourceable, not already bid) and also know each one's
  // suggested_price for default pricing.
  const solNums = pairs.map((p) => p.solicitation_number);
  const nsns = pairs.map((p) => p.nsn);
  const wantKeys = new Set(pairs.map((p) => `${p.solicitation_number}__${p.nsn}`));

  const { data: solRows } = await supabase
    .from("dibbs_solicitations")
    .select("solicitation_number, nsn, nomenclature, quantity, suggested_price, source, source_item, is_sourceable, already_bid, return_by_date")
    .in("solicitation_number", solNums)
    .in("nsn", nsns);
  const solByKey = new Map<string, any>();
  for (const r of solRows || []) {
    const k = `${r.solicitation_number}__${r.nsn}`;
    if (wantKeys.has(k)) solByKey.set(k, r);
  }

  const { data: existingDecisions } = await supabase
    .from("bid_decisions")
    .select("solicitation_number, nsn, status, decided_by")
    .in("solicitation_number", solNums)
    .in("nsn", nsns);
  const decisionByKey = new Map<string, any>();
  for (const d of existingDecisions || []) {
    const k = `${d.solicitation_number}__${d.nsn}`;
    if (wantKeys.has(k)) decisionByKey.set(k, d);
  }

  const skipped: Array<{ solicitation_number: string; nsn: string; reason: string }> = [];
  const records: any[] = [];
  const nowIso = new Date().toISOString();

  for (const p of pairs) {
    const key = `${p.solicitation_number}__${p.nsn}`;
    const sol = solByKey.get(key);
    if (!sol) {
      skipped.push({ ...p, reason: "solicitation not found" });
      continue;
    }
    if (!sol.is_sourceable) {
      skipped.push({ ...p, reason: "not sourceable (NSN not matched)" });
      continue;
    }
    if (sol.already_bid) {
      skipped.push({ ...p, reason: "already bid in LamLinks" });
      continue;
    }

    const existing = decisionByKey.get(key);
    if (existing) {
      if (existing.status === "submitted") {
        skipped.push({ ...p, reason: "already submitted" });
        continue;
      }
      if (existing.decided_by && existing.decided_by !== decidedBy && !isAdmin) {
        skipped.push({ ...p, reason: `owned by ${existing.decided_by}` });
        continue;
      }
    }

    const finalPrice = p.final_price ?? sol.suggested_price;
    if (!finalPrice || finalPrice <= 0) {
      skipped.push({ ...p, reason: "no suggested_price and no override given" });
      continue;
    }

    records.push({
      solicitation_number: p.solicitation_number,
      nsn: p.nsn,
      nomenclature: sol.nomenclature,
      quantity: sol.quantity,
      suggested_price: sol.suggested_price,
      final_price: finalPrice,
      lead_time_days: p.lead_time_days || 45,
      comment: p.comment || null,
      status: "quoted",
      source: sol.source,
      source_item: sol.source_item,
      decided_by: decidedBy,
      updated_at: nowIso,
    });
  }

  if (records.length === 0) {
    return NextResponse.json({
      success: true,
      quoted_count: 0,
      skipped_count: skipped.length,
      skipped,
      message: "Nothing eligible to quote",
    });
  }

  // One bulk upsert for all eligible records (much faster than N round-trips)
  const { error: upsertErr } = await supabase
    .from("bid_decisions")
    .upsert(records, { onConflict: "solicitation_number,nsn" });

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  // Audit log
  await supabase.from("sync_log").insert({
    action: "bids_quoted_batch",
    details: {
      user: decidedBy,
      requested: pairs.length,
      quoted: records.length,
      skipped,
    },
  });

  const { ip, userAgent } = requestContext(req);
  trackEvent({
    userId: user.user.id,
    userName: decidedBy,
    eventType: "bid",
    eventAction: "quote_batch",
    page: "/solicitations",
    details: { requested: pairs.length, quoted: records.length, skipped: skipped.length },
    ip,
    userAgent,
  });

  return NextResponse.json({
    success: true,
    quoted_count: records.length,
    skipped_count: skipped.length,
    skipped,
  });
}
