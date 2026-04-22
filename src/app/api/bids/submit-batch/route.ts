import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";
import { trackEvent, requestContext } from "@/lib/track";
import { isLamlinksWritebackLive } from "@/lib/system-settings";

/**
 * POST /api/bids/submit-batch
 *
 * Batch-submit multiple quoted bids in a single round-trip. The previous
 * client code POSTed /api/bids/decide for each bid sequentially; for 50
 * bids that's ~2.5s of blocking network overhead plus N separate audit
 * writes. This endpoint does it in one DB update with an optimistic
 * filter (WHERE status='quoted') so concurrent state changes don't get
 * silently overwritten.
 *
 * Body: { pairs: Array<{ solicitation_number: string, nsn: string }> }
 *
 * Returns: { updated_count, skipped_count, skipped_pairs }
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
  const pairs: Array<{ solicitation_number: string; nsn: string }> = body?.pairs || [];
  if (!Array.isArray(pairs) || pairs.length === 0) {
    return NextResponse.json(
      { error: "pairs[] required (each: { solicitation_number, nsn })" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const decidedBy = user.profile?.full_name || user.user.email || "unknown";

  // Build an `or()` filter string. PostgREST's `.or()` accepts a
  // comma-separated list of conditions, but each condition must be on a
  // single column. For a composite match we go row-by-row — but in a
  // SINGLE query using `in(solicitation_number, ...)` and then client-side
  // filter is wrong (accidentally matches other NSNs). Safest pattern:
  // one update per pair, but run them in parallel (Promise.all) instead
  // of the previous sequential loop. Still one round-trip worth of latency.
  const solNums = pairs.map((p) => p.solicitation_number);
  const nsns = pairs.map((p) => p.nsn);
  const validKeySet = new Set(pairs.map((p) => `${p.solicitation_number}__${p.nsn}`));

  // Pre-check: auth rule — non-admin can only submit their own quoted bids
  const isAdmin = user.profile?.role === "admin";
  const { data: existing } = await supabase
    .from("bid_decisions")
    .select("solicitation_number, nsn, decided_by, status")
    .in("solicitation_number", solNums)
    .in("nsn", nsns);

  const skipped: Array<{ solicitation_number: string; nsn: string; reason: string }> = [];
  const allowed: Array<{ solicitation_number: string; nsn: string }> = [];

  for (const row of existing || []) {
    const key = `${row.solicitation_number}__${row.nsn}`;
    if (!validKeySet.has(key)) continue; // cartesian false-match from the .in() query
    if (row.status !== "quoted") {
      skipped.push({
        solicitation_number: row.solicitation_number,
        nsn: row.nsn,
        reason: `not in quoted state (was ${row.status})`,
      });
      continue;
    }
    if (!isAdmin && row.decided_by && row.decided_by !== decidedBy) {
      skipped.push({
        solicitation_number: row.solicitation_number,
        nsn: row.nsn,
        reason: `owned by ${row.decided_by}`,
      });
      continue;
    }
    allowed.push({ solicitation_number: row.solicitation_number, nsn: row.nsn });
  }

  // Parallel updates, each guarded by status='quoted' so a concurrent
  // change elsewhere doesn't get clobbered.
  const submittedAt = new Date().toISOString();
  const updateResults = await Promise.all(
    allowed.map((p) =>
      supabase
        .from("bid_decisions")
        .update({
          status: "submitted",
          decided_by: decidedBy,
          updated_at: submittedAt,
        })
        .eq("solicitation_number", p.solicitation_number)
        .eq("nsn", p.nsn)
        .eq("status", "quoted")
        .select("solicitation_number, nsn")
    )
  );
  const updatedCount = updateResults.reduce(
    (n, r) => n + (r.data?.length || 0),
    0
  );
  // Any `allowed` row that didn't produce a matching update row lost the
  // race (someone flipped its status elsewhere). Report it.
  for (let i = 0; i < allowed.length; i++) {
    if ((updateResults[i].data?.length || 0) === 0) {
      skipped.push({
        ...allowed[i],
        reason: "concurrent state change — not in quoted when we tried to flip",
      });
    }
  }

  // If LamLinks write-back is LIVE, enqueue each successfully-updated bid
  // for the Windows worker to transmit. Worker lives on NYEVRVSQL001 (the
  // only host with msnodesqlv8 available) and polls lamlinks_write_queue.
  let enqueuedCount = 0;
  const writebackLive = await isLamlinksWritebackLive();
  if (writebackLive && updatedCount > 0) {
    // Find the bid_decisions rows we just flipped, grab price/qty/lead_time to enqueue.
    const submittedSolNums: string[] = [];
    const submittedNsns: string[] = [];
    for (const r of updateResults) {
      for (const row of r.data || []) {
        submittedSolNums.push(row.solicitation_number);
        submittedNsns.push(row.nsn);
      }
    }
    const { data: details } = await supabase
      .from("bid_decisions")
      .select("solicitation_number, nsn, final_price, quantity, lead_time_days")
      .in("solicitation_number", submittedSolNums)
      .in("nsn", submittedNsns);

    const detailByKey = new Map<string, any>();
    for (const d of details || []) detailByKey.set(`${d.solicitation_number}__${d.nsn}`, d);

    const queueRows: any[] = [];
    for (let i = 0; i < submittedSolNums.length; i++) {
      const key = `${submittedSolNums[i]}__${submittedNsns[i]}`;
      const d = detailByKey.get(key);
      if (!d) continue;
      if (d.final_price == null || !d.quantity || !d.lead_time_days) {
        // Missing inputs — can't enqueue. Leave as submitted-local-only.
        continue;
      }
      queueRows.push({
        solicitation_number: d.solicitation_number,
        nsn: d.nsn,
        bid_price: d.final_price,
        bid_qty: d.quantity,
        delivery_days: d.lead_time_days,
        status: "pending",
        created_by: decidedBy,
      });
    }
    // Tag bid_decisions rows as DIBS-originated so later reporting can
    // distinguish them from Abe-typed-in-LamLinks bids. Best-effort —
    // failure here doesn't affect the actual submission.
    if (queueRows.length > 0) {
      const submittedSolsArr = queueRows.map((q) => q.solicitation_number);
      const submittedNsnsArr = queueRows.map((q) => q.nsn);
      await supabase
        .from("bid_decisions")
        .update({ source_system: "dibs" })
        .in("solicitation_number", submittedSolsArr)
        .in("nsn", submittedNsnsArr);
    }
    if (queueRows.length > 0) {
      // UPSERT-style: ignore duplicates (unique constraint on sol+nsn+status)
      const { data: inserted, error: enqErr } = await supabase
        .from("lamlinks_write_queue")
        .upsert(queueRows, { onConflict: "solicitation_number,nsn,status", ignoreDuplicates: true })
        .select("id");
      enqueuedCount = inserted?.length || 0;
      if (enqErr) {
        console.error("lamlinks_write_queue enqueue error:", enqErr.message);
      }
    }
  }

  const { ip, userAgent } = requestContext(req);
  trackEvent({
    userId: user.user.id,
    userName: decidedBy,
    eventType: "bid",
    eventAction: "submit_batch",
    page: "/solicitations",
    details: { requested: pairs.length, updated: updatedCount, skipped: skipped.length, enqueued: enqueuedCount, writeback_live: writebackLive },
    ip,
    userAgent,
  });

  await supabase.from("sync_log").insert({
    action: "bids_submitted_batch",
    details: { user: decidedBy, requested: pairs.length, updated: updatedCount, skipped, enqueued_to_lamlinks: enqueuedCount, writeback_live: writebackLive },
  });

  return NextResponse.json({
    success: true,
    updated_count: updatedCount,
    skipped_count: skipped.length,
    skipped,
    enqueued_to_lamlinks: enqueuedCount,
    writeback_live: writebackLive,
  });
}
