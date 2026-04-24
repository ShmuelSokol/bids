import { redirect } from "next/navigation";
import { createServiceClient, getCurrentUser, hasAdminAccess } from "@/lib/supabase-server";
import { ResearchSettingsPanel } from "./research-settings-panel";

export const dynamic = "force-dynamic";

async function getData() {
  const sb = createServiceClient();
  const { data: settings } = await sb
    .from("research_settings")
    .select("*")
    .order("key");
  const today = new Date().toISOString().slice(0, 10);
  const { data: spend } = await sb
    .from("research_spend_ledger")
    .select("*")
    .eq("date", today)
    .maybeSingle();
  const { count: queued } = await sb
    .from("nsn_research_status")
    .select("nsn", { count: "exact", head: true })
    .in("queue_status", ["queued", "running"]);
  const { count: researched } = await sb
    .from("nsn_research_status")
    .select("nsn", { count: "exact", head: true })
    .not("last_researched_at", "is", null);
  const { count: failed } = await sb
    .from("nsn_research_status")
    .select("nsn", { count: "exact", head: true })
    .eq("queue_status", "failed");

  // last 7 days of spend
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const { data: weekSpend } = await sb
    .from("research_spend_ledger")
    .select("*")
    .gte("date", sevenDaysAgo)
    .order("date", { ascending: false });

  return {
    settings: settings || [],
    today_spend: spend || { date: today, total_usd: 0, call_count: 0 },
    week_spend: weekSpend || [],
    queued: queued ?? 0,
    researched: researched ?? 0,
    failed: failed ?? 0,
  };
}

export default async function ResearchSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasAdminAccess(user.profile?.role)) redirect("/settings");

  const data = await getData();
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <ResearchSettingsPanel {...data} />
    </div>
  );
}
