import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { OpsLamlinks } from "./ops-lamlinks";

export default async function OpsLamlinksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "superadmin") redirect("/settings");

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">LamLinks Ops</h1>
        <p className="text-muted text-sm mt-1">
          Incident-response console for stuck quote envelopes. All actions
          round-trip through the Windows worker on NYEVRVSQL001 (Railway
          can&apos;t reach the LL DB directly). Superadmin only.
        </p>
      </div>
      <OpsLamlinks />
    </div>
  );
}
