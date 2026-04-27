/**
 * lamlinks_rest_queue helpers.
 *
 * DIBS API routes use these to enqueue Sally REST calls and read results.
 * The actual HTTP work happens on a whitelisted box (NYEVRVTC001) running
 * scripts/ll-rest-worker.ts. Railway/GLOVE cannot reach api.lamlinks.com
 * directly — IP whitelist (confirmed 2026-04-27).
 *
 * See docs/architecture/sally-rest-worker.md.
 */

import { createServiceClient } from "./supabase-server";

export interface EnqueueOptions {
  lisFunction: string;
  reqDataXml?: string;        // already-escaped XML body for <req_data>...</req_data>; default empty
  eCode?: string;             // default '0AG09'
  waitSeconds?: number;       // default 30
  enqueuedBy?: string;        // route name / user id, for tracing
  relatedKind?: string;       // e.g. 'bid_writeback', 'heartbeat'
  relatedId?: string;         // bid_decisions.id, etc.
}

export interface QueueRow {
  id: number;
  lis_function: string;
  e_code: string;
  req_data_xml: string;
  wait_seconds: number;
  state: "pending" | "running" | "done" | "error" | "timeout";
  enqueued_at: string;
  started_at: string | null;
  completed_at: string | null;
  http_status: number | null;
  completion_code: number | null;
  response_xml: string | null;
  error_message: string | null;
  enqueued_by: string | null;
  related_kind: string | null;
  related_id: string | null;
  worker_host: string | null;
}

export async function enqueueRestCall(opts: EnqueueOptions): Promise<QueueRow> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("lamlinks_rest_queue")
    .insert({
      lis_function: opts.lisFunction,
      req_data_xml: opts.reqDataXml ?? "",
      e_code: opts.eCode ?? "0AG09",
      wait_seconds: opts.waitSeconds ?? 30,
      enqueued_by: opts.enqueuedBy ?? null,
      related_kind: opts.relatedKind ?? null,
      related_id: opts.relatedId ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(`enqueueRestCall failed: ${error.message}`);
  return data as QueueRow;
}

export async function getQueueRow(id: number): Promise<QueueRow | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("lamlinks_rest_queue")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getQueueRow failed: ${error.message}`);
  return (data as QueueRow) ?? null;
}

/**
 * Poll until the row reaches a terminal state or timeout.
 * Default timeout 60s — if your call genuinely needs longer, set
 * waitSeconds on enqueue and pass timeoutMs accordingly.
 */
export async function waitForCompletion(
  id: number,
  timeoutMs: number = 60_000,
  pollIntervalMs: number = 1_000,
): Promise<QueueRow> {
  const deadline = Date.now() + timeoutMs;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const row = await getQueueRow(id);
    if (!row) throw new Error(`Queue row ${id} disappeared`);
    if (row.state === "done" || row.state === "error" || row.state === "timeout") return row;
    if (Date.now() > deadline) {
      // Mark it as timed-out so the worker knows not to bother.
      const sb = createServiceClient();
      await sb
        .from("lamlinks_rest_queue")
        .update({ state: "timeout", completed_at: new Date().toISOString(), error_message: "Caller-side timeout" })
        .eq("id", id)
        .eq("state", "pending"); // only if still pending; running tasks finish on their own
      const final = await getQueueRow(id);
      return final ?? row;
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
}

/** Enqueue + wait. Convenience wrapper for callers that want sync semantics. */
export async function callRest(
  opts: EnqueueOptions,
  timeoutMs?: number,
): Promise<QueueRow> {
  const row = await enqueueRestCall(opts);
  return waitForCompletion(row.id, timeoutMs ?? (opts.waitSeconds ?? 30) * 1000 + 10_000);
}

/**
 * Queue health snapshot — pending/running counts and last failure.
 * Used by /ops/dibs-pipeline.
 */
export async function getQueueHealth(): Promise<{
  pending: number;
  running: number;
  doneLast24h: number;
  errorLast24h: number;
  oldestPendingAgeSec: number | null;
  lastError: QueueRow | null;
  lastHeartbeat: QueueRow | null;
}> {
  const sb = createServiceClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [pending, running, done, error, oldest, lastError, lastHeartbeat] = await Promise.all([
    sb.from("lamlinks_rest_queue").select("id", { count: "exact", head: true }).eq("state", "pending"),
    sb.from("lamlinks_rest_queue").select("id", { count: "exact", head: true }).eq("state", "running"),
    sb.from("lamlinks_rest_queue").select("id", { count: "exact", head: true }).eq("state", "done").gte("completed_at", since),
    sb.from("lamlinks_rest_queue").select("id", { count: "exact", head: true }).eq("state", "error").gte("completed_at", since),
    sb.from("lamlinks_rest_queue").select("enqueued_at").eq("state", "pending").order("enqueued_at", { ascending: true }).limit(1).maybeSingle(),
    sb.from("lamlinks_rest_queue").select("*").eq("state", "error").order("completed_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("lamlinks_rest_queue").select("*").eq("lis_function", "are_you_listening").eq("state", "done").order("completed_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const oldestAge =
    oldest.data?.enqueued_at
      ? Math.round((Date.now() - new Date(oldest.data.enqueued_at).getTime()) / 1000)
      : null;

  return {
    pending: pending.count ?? 0,
    running: running.count ?? 0,
    doneLast24h: done.count ?? 0,
    errorLast24h: error.count ?? 0,
    oldestPendingAgeSec: oldestAge,
    lastError: (lastError.data as QueueRow) ?? null,
    lastHeartbeat: (lastHeartbeat.data as QueueRow) ?? null,
  };
}

/**
 * Build the inner XML for <req_data> for a put_client_quote call.
 * The shape is dictated by LL — this is the wire format Sally expects.
 *
 * NOTE: caller must already have the bid envelope created in k33/k34/k35 via
 * SQL writeback OR build the full XML payload here. For the SQL+REST hybrid
 * path we just want to nudge LL to transmit; for pure-REST writeback we'd
 * embed the full quote payload.
 */
export function buildHeartbeatReqData(): string {
  return ""; // are_you_listening takes no req_data
}
