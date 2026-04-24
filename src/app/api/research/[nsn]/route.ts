import { NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ nsn: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const { nsn: raw } = await params;
  const nsn = decodeURIComponent(raw);

  const sb = createServiceClient();
  const [{ data: status }, { data: findings }, { data: picks }, { data: settings }] = await Promise.all([
    sb.from("nsn_research_status").select("*").eq("nsn", nsn).maybeSingle(),
    sb
      .from("nsn_research_findings")
      .select("*")
      .eq("nsn", nsn)
      .eq("superseded", false)
      .order("confidence", { ascending: false }),
    sb
      .from("nsn_supplier_picks")
      .select("*")
      .eq("nsn", nsn)
      .eq("active", true)
      .order("picked_at", { ascending: false })
      .limit(5),
    sb.from("research_settings").select("key, value").eq("key", "max_candidates_per_nsn"),
  ]);

  return NextResponse.json({
    nsn,
    status: status || null,
    findings: findings || [],
    picks: picks || [],
    max_candidates: Number(settings?.[0]?.value || "6"),
  });
}
