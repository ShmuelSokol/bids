import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { UsersManager } from "./users-manager";

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "superadmin") redirect("/settings");

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Users &amp; Roles</h1>
        <p className="text-muted text-sm mt-1">
          Manage who has access to DIBS and what they can do. Changes take effect the next time they load a page.
        </p>
      </div>
      <UsersManager />
    </div>
  );
}
