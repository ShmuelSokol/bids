import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createServiceClient, getCurrentUser, hasAdminAccess } from "@/lib/supabase-server";
import { SuppliersList } from "./suppliers-list";

export const dynamic = "force-dynamic";

/**
 * /suppliers — DIBS suppliers registry. Unifies AX-known vendor emails,
 * auto-research-discovered suppliers, and manually-added contacts. Used by
 * the RFQ outbound flow (Phase 2.x) to know who to email.
 */

async function getData() {
  const sb = createServiceClient();

  // Pull all (probably <1000 for a while; paginate later if needed)
  const all: any[] = [];
  for (let p = 0; p < 10; p++) {
    const { data } = await sb
      .from("dibs_suppliers")
      .select("*")
      .order("name")
      .range(p * 1000, (p + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
  }

  // Counts by source
  const counts = {
    total: all.length,
    ax: all.filter((r) => r.source === "ax").length,
    research: all.filter((r) => r.source === "research").length,
    manual: all.filter((r) => r.source === "manual").length,
    blocked: all.filter((r) => r.blocked).length,
    withEmail: all.filter((r) => r.email && r.email.includes("@")).length,
  };

  // Last AX sync
  const { data: lastSync } = await sb
    .from("sync_log")
    .select("created_at, details")
    .eq("action", "sync_suppliers_from_ax")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { rows: all, counts, lastSync };
}

export default async function SuppliersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasAdminAccess(user.profile?.role)) redirect("/settings");

  const data = await getData();
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-2 mb-4 text-sm text-muted">
        <Link href="/" className="hover:text-accent flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Home
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Suppliers</span>
      </div>
      <SuppliersList {...data} />
    </div>
  );
}
