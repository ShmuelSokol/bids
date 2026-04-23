import { redirect } from "next/navigation";
import { getCurrentUser, hasAdminAccess } from "@/lib/supabase-server";
import { QueueMonitor } from "./queue-monitor";

export default async function QueueMonitorPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!hasAdminAccess(me.profile?.role)) redirect("/settings");

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">LamLinks Write Queue</h1>
        <p className="text-muted text-sm mt-1">
          Live view of DIBS → LamLinks bid transmission. Pending rows get claimed by the Windows worker and written into k33/k34/k35.
        </p>
      </div>
      <QueueMonitor />
    </div>
  );
}
