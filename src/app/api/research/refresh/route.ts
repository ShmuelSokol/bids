import { NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const { nsn } = await req.json();
  if (!nsn) return NextResponse.json({ error: "nsn required" }, { status: 400 });

  const sb = createServiceClient();
  // Bump priority by 10% over whatever it was + mark queued
  const { data: existing } = await sb
    .from("nsn_research_status")
    .select("priority_score, refresh_count")
    .eq("nsn", nsn)
    .maybeSingle();
  const priority = Number(existing?.priority_score || 100) * 1.1;
  const refreshCount = Number(existing?.refresh_count || 0) + 1;

  await sb.from("nsn_research_status").upsert(
    {
      nsn,
      queue_status: "queued",
      queued_at: new Date().toISOString(),
      priority_score: priority,
      refresh_count: refreshCount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "nsn" }
  );

  return NextResponse.json({ ok: true, priority_score: priority });
}
