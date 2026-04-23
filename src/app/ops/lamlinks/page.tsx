import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase-server";
import { OpsLamlinks } from "./ops-lamlinks";

export default async function OpsLamlinksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "superadmin") redirect("/settings");

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">LamLinks Ops</h1>
          <p className="text-muted text-sm mt-1">
            Incident-response console for stuck quote envelopes. All actions
            round-trip through the Windows worker on NYEVRVSQL001 (Railway
            can&apos;t reach the LL DB directly). Superadmin only.
          </p>
        </div>
        <Link
          href="/ops/lamlinks/transmissions"
          className="inline-flex items-center gap-2 rounded-lg border border-card-border px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
        >
          <Activity className="h-4 w-4" /> EDI Transmissions
        </Link>
      </div>
      <OpsLamlinks />
    </div>
  );
}
