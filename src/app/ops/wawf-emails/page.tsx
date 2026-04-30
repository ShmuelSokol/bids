import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createServiceClient, getCurrentUser, hasAdminAccess } from "@/lib/supabase-server";
import { WawfEmailsDashboard } from "./wawf-emails-dashboard";

export const dynamic = "force-dynamic";

/**
 * /ops/wawf-emails — parsed history of WAWF acceptance/rejection emails
 * pulled from Abe's inbox via EWS by `scripts/parse-wawf-emails.ts`.
 *
 * Use cases:
 *  - Verify a specific CIN went through (vs trusting kbr alone)
 *  - Surface real-failure rejects (UoM, dup, contract not found) for triage
 *  - Audit the auto-actions the parser took (kbr_action, alerted)
 */

async function getData() {
  const sb = createServiceClient();

  const { data: rows } = await sb
    .from("wawf_email_log")
    .select("*")
    .order("received_at", { ascending: false })
    .limit(500);

  // Quick aggregations for the header strip
  const counts = {
    total: rows?.length || 0,
    accepted: rows?.filter((r: any) => r.outcome === "accepted" || r.outcome === "accepted_with_modifications").length || 0,
    rejected: rows?.filter((r: any) => r.outcome === "rejected").length || 0,
    rejectedBenign: rows?.filter((r: any) => r.outcome === "rejected_benign").length || 0,
    unparseable: rows?.filter((r: any) => r.outcome === "unparseable").length || 0,
    alertsFired: rows?.filter((r: any) => r.alerted).length || 0,
  };

  // Last successful parser run from sync_log (best-effort)
  const { data: lastSync } = await sb
    .from("sync_log")
    .select("created_at, details")
    .eq("action", "parse_wawf_emails")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { rows: rows || [], counts, lastSync };
}

export default async function WawfEmailsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasAdminAccess(user.profile?.role)) redirect("/settings");

  const data = await getData();
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-2 mb-4 text-sm text-muted">
        <Link href="/ops/lamlinks" className="hover:text-accent flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> LamLinks Ops
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">WAWF Emails</span>
      </div>
      <WawfEmailsDashboard {...data} />
    </div>
  );
}
