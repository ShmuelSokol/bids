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

/**
 * Returns { online: bool, lastHeartbeat: ISO|null, ageSeconds: number|null }.
 * The worker updates lamlinks_worker_last_heartbeat on every poll (~30s).
 * If it's older than ~2 min the worker is effectively offline and any
 * LIVE-toggled writes will queue forever without transmission.
 */
export async function getLamlinksWorkerHealth(): Promise<{
  online: boolean;
  lastHeartbeat: string | null;
  ageSeconds: number | null;
}> {
  const v = await getSystemSetting("lamlinks_worker_last_heartbeat");
  if (!v) return { online: false, lastHeartbeat: null, ageSeconds: null };
  const lastMs = new Date(v).getTime();
  if (!Number.isFinite(lastMs)) return { online: false, lastHeartbeat: v, ageSeconds: null };
  const ageSeconds = Math.round((Date.now() - lastMs) / 1000);
  return { online: ageSeconds < 120, lastHeartbeat: v, ageSeconds };
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
