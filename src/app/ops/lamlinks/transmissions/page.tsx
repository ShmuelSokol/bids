import { redirect } from "next/navigation";
import { createServiceClient, getCurrentUser, hasAdminAccess } from "@/lib/supabase-server";
import { TransmissionsDashboard } from "./transmissions-dashboard";

async function getData() {
  const sb = createServiceClient();

  // Count by lifecycle bucket for the header stats
  const { data: lifecycleCounts } = await sb
    .from("ll_edi_transmissions")
    .select("lifecycle, edi_type")
    .gte("transmitted_at", new Date(Date.now() - 90 * 86_400_000).toISOString());

  // Pull recent transmissions — last 500, newest first
  const { data: recent } = await sb
    .from("ll_edi_transmissions")
    .select("*")
    .order("transmitted_at", { ascending: false })
    .limit(500);

  // DPMS specifically — these are the ones that stay "pending" for a long time
  const { data: dpms } = await sb
    .from("ll_edi_transmissions")
    .select("*")
    .eq("edi_type", "DPMS")
    .order("transmitted_at", { ascending: false })
    .limit(200);

  // Problem records — the red flags
  const { data: problems } = await sb
    .from("ll_edi_transmissions")
    .select("*")
    .eq("lifecycle", "problem")
    .order("transmitted_at", { ascending: false })
    .limit(100);

  // Last sync time
  const { data: lastSync } = await sb
    .from("sync_log")
    .select("created_at, details")
    .eq("action", "ll_edi_transmissions_sync")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    recent: recent || [],
    dpms: dpms || [],
    problems: problems || [],
    lifecycleCounts: lifecycleCounts || [],
    lastSync: lastSync?.created_at || null,
  };
}

export default async function TransmissionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasAdminAccess(user.profile?.role)) redirect("/settings");

  const data = await getData();

  return (
    <div className="p-4 md:p-8">
      <TransmissionsDashboard {...data} />
    </div>
  );
}
