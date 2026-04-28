import { createServiceClient } from "@/lib/supabase-server";

export async function getSystemSetting(key: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return (data as any)?.value ?? null;
}

export async function isLamlinksWritebackLive(): Promise<boolean> {
  const v = await getSystemSetting("lamlinks_writeback_enabled");
  return v === "true";
}

export async function isFreshEnvelopeEnabled(): Promise<boolean> {
  // Default ON — fresh-envelope mode works (validated 2026-04-28) but
  // produces cosmetic VFP cursor error 9977720 when Abe Posts. Flip OFF
  // to suppress the error at the cost of requiring Abe to seed each
  // batch by saving one bid in LL first.
  const v = await getSystemSetting("lamlinks_fresh_envelope_enabled");
  return v !== "false"; // null/missing → default true
}

/**
 * Returns { online, lastHeartbeat, ageSeconds, host }.
 * The worker updates lamlinks_worker_last_heartbeat + lamlinks_worker_host
 * on every poll (~30s). If the heartbeat is older than ~2 min the worker
 * is effectively offline and any LIVE-toggled writes will queue forever
 * without transmission.
 *
 * `host` is whatever box currently runs the daemon (read from a setting
 * the worker writes itself, so the UI always points operators at the
 * right box even if the task is moved).
 */
export async function getLamlinksWorkerHealth(): Promise<{
  online: boolean;
  lastHeartbeat: string | null;
  ageSeconds: number | null;
  host: string | null;
}> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("system_settings")
    .select("key, value")
    .in("key", ["lamlinks_worker_last_heartbeat", "lamlinks_worker_host"]);
  const rows = (data || []) as Array<{ key: string; value: string }>;
  const v = rows.find((r) => r.key === "lamlinks_worker_last_heartbeat")?.value ?? null;
  const host = rows.find((r) => r.key === "lamlinks_worker_host")?.value ?? null;
  if (!v) return { online: false, lastHeartbeat: null, ageSeconds: null, host };
  const lastMs = new Date(v).getTime();
  if (!Number.isFinite(lastMs)) return { online: false, lastHeartbeat: v, ageSeconds: null, host };
  const ageSeconds = Math.round((Date.now() - lastMs) / 1000);
  return { online: ageSeconds < 120, lastHeartbeat: v, ageSeconds, host };
}

export async function setSystemSetting(
  key: string,
  value: string,
  updatedBy?: string
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("system_settings")
    .upsert(
      { key, value, updated_at: new Date().toISOString(), updated_by: updatedBy ?? null },
      { onConflict: "key" }
    );
  if (error) throw error;
}
