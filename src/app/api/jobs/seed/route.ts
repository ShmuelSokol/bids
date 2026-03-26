import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * POST /api/jobs/seed?type=supplier_discovery
 *
 * Seeds the job queue with work items. Types:
 *   supplier_discovery — add unsourced solicitations to find suppliers
 *   nsn_crawl          — add all NSNs that need enrichment
 *   award_lookup       — add CAGE codes that need company names
 */
export async function POST(req: NextRequest) {
  const supabase = createServiceClient();
  const type = req.nextUrl.searchParams.get("type") || "supplier_discovery";

  let jobs: any[] = [];

  if (type === "supplier_discovery") {
    // Get unsourced solicitations that are still open and don't already have a job
    const { data: unsourced } = await supabase
      .from("dibbs_solicitations")
      .select("nsn, nomenclature, solicitation_number, quantity, est_value")
      .eq("is_sourceable", false)
      .not("nomenclature", "is", null)
      .order("scraped_at", { ascending: false })
      .limit(2000);

    // Check which NSNs already have jobs
    const { data: existing } = await supabase
      .from("job_queue")
      .select("payload")
      .eq("job_type", "supplier_discovery")
      .in("status", ["pending", "processing", "done"]);

    const existingNsns = new Set(
      (existing || []).map((j: any) => j.payload?.nsn).filter(Boolean)
    );

    // Also check which NSNs already have discovered suppliers
    const { data: discovered } = await supabase
      .from("discovered_suppliers")
      .select("nsn");
    const discoveredNsns = new Set(
      (discovered || []).map((d: any) => d.nsn).filter(Boolean)
    );

    jobs = (unsourced || [])
      .filter((s: any) => s.nsn && !existingNsns.has(s.nsn) && !discoveredNsns.has(s.nsn))
      .map((s: any) => ({
        job_type: "supplier_discovery",
        payload: {
          nsn: s.nsn,
          nomenclature: s.nomenclature,
          solicitation_number: s.solicitation_number,
          quantity: s.quantity,
          est_value: s.est_value,
        },
      }));

    // Deduplicate by NSN
    const seen = new Set<string>();
    jobs = jobs.filter((j) => {
      if (seen.has(j.payload.nsn)) return false;
      seen.add(j.payload.nsn);
      return true;
    });

  } else if (type === "nsn_crawl") {
    // Get NSNs from catalog that need enrichment
    const { data: nsns } = await supabase
      .from("nsn_catalog")
      .select("nsn")
      .limit(5000);

    const { data: existing } = await supabase
      .from("job_queue")
      .select("payload")
      .eq("job_type", "nsn_crawl")
      .in("status", ["pending", "processing", "done"]);

    const existingNsns = new Set(
      (existing || []).map((j: any) => j.payload?.nsn).filter(Boolean)
    );

    jobs = (nsns || [])
      .filter((n: any) => n.nsn && !existingNsns.has(n.nsn))
      .map((n: any) => ({
        job_type: "nsn_crawl",
        payload: { nsn: n.nsn },
      }));

  } else if (type === "award_lookup") {
    // Get unique CAGE codes from awards that need company name lookup
    const { data: awards } = await supabase
      .from("awards")
      .select("cage")
      .limit(5000);

    const uniqueCages = [...new Set((awards || []).map((a: any) => a.cage?.trim()).filter(Boolean))];

    const { data: existing } = await supabase
      .from("job_queue")
      .select("payload")
      .eq("job_type", "award_lookup")
      .in("status", ["pending", "processing", "done"]);

    const existingCages = new Set(
      (existing || []).map((j: any) => j.payload?.cage).filter(Boolean)
    );

    jobs = uniqueCages
      .filter((c) => !existingCages.has(c))
      .map((cage) => ({
        job_type: "award_lookup",
        payload: { cage },
      }));
  }

  // Insert jobs in batches
  let inserted = 0;
  for (let i = 0; i < jobs.length; i += 100) {
    const batch = jobs.slice(i, i + 100);
    const { error } = await supabase.from("job_queue").insert(batch);
    if (!error) inserted += batch.length;
  }

  return NextResponse.json({
    type,
    total_candidates: jobs.length,
    inserted,
  });
}
