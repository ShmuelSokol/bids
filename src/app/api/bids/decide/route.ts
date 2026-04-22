import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser, hasAdminAccess } from "@/lib/supabase-server";
import { trackEvent, requestContext } from "@/lib/track";

const VALID_STATUSES = new Set(["quoted", "submitted", "skipped"]);

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Force-reset users can't write bid decisions until they've set a new password.
  if (user.profile?.must_reset_password) {
    return NextResponse.json(
      { error: "Password reset required before making bid decisions" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const {
    solicitation_number,
    nsn,
    nomenclature,
    quantity,
    suggested_price,
    final_price,
    lead_time_days,
    comment,
    status,
    source,
    source_item,
  } = body;

  if (!solicitation_number || !nsn || !status) {
    return NextResponse.json(
      { error: "solicitation_number, nsn, and status required" },
      { status: 400 }
    );
  }

  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${[...VALID_STATUSES].join(", ")}` },
      { status: 400 }
    );
  }

  if ((status === "quoted" || status === "submitted") && (final_price == null || final_price <= 0)) {
    return NextResponse.json(
      { error: "final_price > 0 required for quoted/submitted bids" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const decidedBy = user.profile?.full_name || user.user.email || "unknown";

  // Server-side sourceable check — the UI hides the Quote button on
  // non-sourceable rows, but a stale tab or direct call could bypass it.
  // Skip is always allowed; the solicitation might just be wrong.
  if (status === "quoted" || status === "submitted") {
    const { data: sol, error: solErr } = await supabase
      .from("dibbs_solicitations")
      .select("is_sourceable, already_bid, return_by_date")
      .eq("solicitation_number", solicitation_number)
      .eq("nsn", nsn)
      .maybeSingle();

    if (solErr) {
      return NextResponse.json({ error: solErr.message }, { status: 500 });
    }
    if (!sol) {
      return NextResponse.json(
        { error: "Solicitation not found" },
        { status: 404 }
      );
    }
    if (!sol.is_sourceable) {
      return NextResponse.json(
        { error: "Cannot quote/submit a non-sourceable item" },
        { status: 400 }
      );
    }
    if (sol.already_bid) {
      return NextResponse.json(
        { error: "Solicitation was already bid in LamLinks" },
        { status: 400 }
      );
    }
  }

  // Row-level auth: if a decision already exists, only the original decider
  // (or an admin) can overwrite it. Prevents silent overwrites between users.
  const { data: existing } = await supabase
    .from("bid_decisions")
    .select("decided_by, status, final_price")
    .eq("solicitation_number", solicitation_number)
    .eq("nsn", nsn)
    .maybeSingle();

  if (existing?.decided_by && existing.decided_by !== decidedBy) {
    const isAdmin = hasAdminAccess(user.profile?.role);
    if (!isAdmin) {
      return NextResponse.json(
        {
          error: `Bid was already decided by ${existing.decided_by}. Ask them to change it or request admin override.`,
        },
        { status: 403 }
      );
    }
  }

  const record: Record<string, unknown> = {
    solicitation_number,
    nsn,
    nomenclature,
    quantity,
    suggested_price,
    final_price,
    lead_time_days: lead_time_days || 45,
    comment,
    status,
    source,
    source_item,
    decided_by: decidedBy,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("bid_decisions")
    .upsert(record, { onConflict: "solicitation_number,nsn" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Track the bid decision
  const { ip, userAgent } = requestContext(req);
  trackEvent({
    userId: user.user.id,
    userName: decidedBy,
    eventType: "bid",
    eventAction: status,
    page: "/solicitations",
    details: {
      solicitation_number,
      nsn,
      nomenclature,
      final_price,
      suggested_price,
      quantity,
      lead_time_days,
      prior_status: existing?.status,
      prior_final_price: existing?.final_price,
    },
    ip,
    userAgent,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const items: Array<{ solicitation_number: string; nsn: string }> = body.items || [];
  if (items.length === 0) {
    // Single item
    const { solicitation_number, nsn } = body;
    if (solicitation_number && nsn) items.push({ solicitation_number, nsn });
  }
  if (items.length === 0) return NextResponse.json({ error: "No items to unquote" }, { status: 400 });

  const supabase = createServiceClient();
  const decidedBy = user.profile?.full_name || user.user.email || "unknown";
  let deleted = 0;

  for (const item of items) {
    const { error } = await supabase
      .from("bid_decisions")
      .delete()
      .eq("solicitation_number", item.solicitation_number)
      .eq("nsn", item.nsn);
    if (!error) deleted++;
  }

  const { ip, userAgent } = requestContext(req);
  trackEvent({
    userId: user.user.id,
    userName: decidedBy,
    eventType: "bid",
    eventAction: "unquote",
    page: "/solicitations",
    details: { count: deleted, requested: items.length },
    ip,
    userAgent,
  });

  return NextResponse.json({ success: true, deleted });
}
