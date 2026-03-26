import { getCurrentUser } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { BugManager } from "./bug-manager";

export default async function BugsPage() {
  const user = await getCurrentUser().catch(() => null);

  // Admin only
  if (!user?.profile?.role || user.profile.role !== "admin") {
    redirect("/");
  }

  return (
    <div className="p-4 md:p-8">
      <BugManager userName={user.profile?.full_name || user.user?.email || "Admin"} />
    </div>
  );
}
