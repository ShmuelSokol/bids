import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * POST /api/jobs/seed-awards
 *
 * Seeds the job queue with USASpending award pull tasks.
 * Creates one job per month per FSC for the last 2 years.
 * Each job pulls one month of DLA awards for one FSC.
 */
export async function POST() {
  const supabase = createServiceClient();

  // Get our active FSCs
  const { data: heatmap } = await supabase
    .from("fsc_heatmap")
    .select("fsc_code")
    .limit(500);

  const fscs = (heatmap || []).map((r: any) => r.fsc_code).filter(Boolean);

  // Generate monthly date ranges for last 2 years
  const now = new Date();
  const months: { start: string; end: string }[] = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = d.toISOString().split("T")[0];
    const endD = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const end = endD.toISOString().split("T")[0];
    months.push({ start, end });
  }

  // Check existing jobs to avoid duplicates
  const { data: existing } = await supabase
    .from("job_queue")
    .select("payload")
    .eq("job_type", "usaspending_awards")
    .in("status", ["pending", "processing", "done"]);

  const existingKeys = new Set(
    (existing || []).map((j: any) => `${j.payload?.fsc}_${j.payload?.start}`)
  );

  // Create jobs — one per FSC per month
  const jobs: any[] = [];
  for (const fsc of fscs) {
    for (const month of months) {
      const key = `${fsc}_${month.start}`;
      if (existingKeys.has(key)) continue;
      jobs.push({
        job_type: "usaspending_awards",
        payload: { fsc, start: month.start, end: month.end },
      });
    }
  }

  // Insert in batches
  let inserted = 0;
  for (let i = 0; i < jobs.length; i += 100) {
    const batch = jobs.slice(i, i + 100);
    const { error } = await supabase.from("job_queue").insert(batch);
    if (!error) inserted += batch.length;
  }

  return NextResponse.json({
    fscs: fscs.length,
    months: months.length,
    total_jobs: jobs.length,
    inserted,
    skipped_existing: fscs.length * months.length - jobs.length,
  });
}
