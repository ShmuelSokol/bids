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
