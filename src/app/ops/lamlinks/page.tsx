import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, Mail } from "lucide-react";
import { getCurrentUser, hasAdminAccess } from "@/lib/supabase-server";
import { OpsLamlinks } from "./ops-lamlinks";

export default async function OpsLamlinksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasAdminAccess(user.profile?.role)) redirect("/settings");

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">LamLinks Ops</h1>
          <p className="text-muted text-sm mt-1">
            Incident-response console for stuck quote envelopes. All actions
            round-trip through the Windows worker on the daemon host (Railway
            can&apos;t reach the LL DB directly). Superadmin only.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/ops/dibs-pipeline"
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-800 px-3 py-1.5 text-sm font-medium hover:bg-indigo-100"
          >
            <Activity className="h-4 w-4" /> DIBS Pipeline
          </Link>
          <Link
            href="/ops/lamlinks/ack-tracker"
            className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 text-red-800 px-3 py-1.5 text-sm font-medium hover:bg-red-100"
          >
            <Activity className="h-4 w-4" /> Ack Tracker
          </Link>
          <Link
            href="/ops/lamlinks/transmissions"
            className="inline-flex items-center gap-2 rounded-lg border border-card-border px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
          >
            <Activity className="h-4 w-4" /> EDI Transmissions
          </Link>
          <Link
            href="/ops/wawf-emails"
            className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 text-blue-800 px-3 py-1.5 text-sm font-medium hover:bg-blue-100"
          >
            <Mail className="h-4 w-4" /> WAWF Emails
          </Link>
        </div>
      </div>
      <OpsLamlinks />
    </div>
  );
}
