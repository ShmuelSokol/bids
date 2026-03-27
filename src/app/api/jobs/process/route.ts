import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * POST /api/jobs/process
 *
 * Processes a batch of jobs from the queue. Called by GitHub Actions cron
 * every 5 minutes, or manually. Handles rate limiting internally.
 *
 * Job types:
 *   nsn_crawl          — look up NSN on nsnlookup.com
 *   supplier_discovery — find wholesale suppliers for unsourced NSNs
 *   award_lookup       — look up CAGE code company names
 *   dibbs_scrape_fsc   — scrape a single FSC from DIBBS
 */

const BATCH_SIZE = 5; // jobs per call
const DELAY_MS = 2000; // between requests

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// --- Job Handlers ---

async function handleNsnCrawl(payload: any): Promise<any> {
  const { nsn } = payload;
  if (!nsn) throw new Error("Missing nsn");

  const resp = await fetch(
    `https://www.nsnlookup.com/search?q=${nsn.replace(/-/g, "")}`,
    {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(10000),
    }
  );
  const html = await resp.text();

  // Extract item name
  const nameMatch = html.match(/Item Name[:\s]*<[^>]*>([^<]+)/i);
  const cageMatch = html.match(/CAGE[:\s]*<[^>]*>(\w{5})/i);
  const descMatch = html.match(/Description[:\s]*<[^>]*>([^<]+)/i);

  return {
    nsn,
    item_name: nameMatch?.[1]?.trim() || null,
    cage_code: cageMatch?.[1]?.trim() || null,
    description: descMatch?.[1]?.trim() || null,
  };
}

async function handleSupplierDiscovery(payload: any, supabase: any): Promise<any> {
  const { nsn, nomenclature, solicitation_number, quantity, est_value } = payload;
  if (!nsn && !nomenclature) throw new Error("Missing nsn or nomenclature");

  const cleanName = (nomenclature || "").replace(/[^a-zA-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const results: any[] = [];

  // Search using DuckDuckGo (doesn't block cloud IPs like Google)
  const searches = [
    { query: `${cleanName} wholesale supplier`, source: "wholesale" },
    { query: `NSN ${nsn} supplier distributor`, source: "nsn_search" },
    { query: `${cleanName} bulk buy medical supply`, source: "bulk_buy" },
  ];

  for (const search of searches) {
    try {
      const resp = await fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(search.query)}`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          signal: AbortSignal.timeout(10000),
        }
      );
      const html = await resp.text();

      // Extract URLs and titles from DuckDuckGo results
      const linkPattern = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      // Also try generic link pattern
      const linkPattern2 = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      const patterns = [linkPattern, linkPattern2];

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
          const url = decodeURIComponent(match[1]);
          const title = match[2].replace(/<[^>]+>/g, "").trim();
          if (!url.startsWith("http") || url.includes("duckduckgo.com") || url.includes("youtube.com")) continue;

        try {
          const domain = new URL(url).hostname.replace("www.", "");
          // Skip known non-supplier domains
          if (["wikipedia.org", "reddit.com", "amazon.com", "ebay.com", "facebook.com", "twitter.com"].includes(domain)) continue;

          results.push({
            nsn,
            solicitation_number,
            nomenclature: cleanName,
            supplier_name: title.slice(0, 100),
            supplier_url: url,
            supplier_domain: domain,
            search_query: search.query,
            search_source: search.source,
            confidence: title.toLowerCase().includes("wholesale") || title.toLowerCase().includes("supplier") || title.toLowerCase().includes("distributor") ? "medium" : "low",
          });
        } catch {}
        }
      }

      await delay(DELAY_MS);
    } catch {}
  }

  // Deduplicate by domain
  const seen = new Set<string>();
  const unique = results.filter((r) => {
    if (seen.has(r.supplier_domain)) return false;
    seen.add(r.supplier_domain);
    return true;
  });

  // Save to discovered_suppliers
  if (unique.length > 0) {
    await supabase
      .from("discovered_suppliers")
      .upsert(unique, { onConflict: "nsn,supplier_domain", ignoreDuplicates: true });
  }

  return { nsn, suppliers_found: unique.length, searches: searches.length };
}

async function handleAwardLookup(payload: any, supabase: any): Promise<any> {
  const { cage } = payload;
  if (!cage) throw new Error("Missing cage");

  const resp = await fetch(`https://cage.report/CAGE/${cage}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(8000),
  });
  const html = await resp.text();
  const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const name = nameMatch?.[1]?.trim()?.replace(/&amp;/g, "&") || null;

  // Save to cage_directory
  if (name) {
    await supabase.from("cage_directory").upsert(
      { cage_code: cage, company_name: name, source: "cage_report" },
      { onConflict: "cage_code" }
    );
  }

  return { cage, company_name: name };
}

async function handleUsaspendingAwards(payload: any, supabase: any): Promise<any> {
  const { fsc, start, end } = payload;
  if (!fsc || !start || !end) throw new Error("Missing fsc, start, or end");

  // Query USASpending API for DLA awards in this FSC + date range
  const body = {
    filters: {
      agencies: [{ type: "awarding", tier: "subtier", name: "Defense Logistics Agency" }],
      award_type_codes: ["A", "B", "C", "D"],
      time_period: [{ start_date: start, end_date: end }],
      psc_codes: [fsc],
    },
    fields: [
      "Award ID", "Recipient Name", "Recipient DUNS", "Award Amount",
      "Start Date", "End Date", "Description", "PSC Code",
      "recipient_id", "prime_award_recipient_id",
    ],
    limit: 100,
    page: 1,
  };

  let allResults: any[] = [];
  let page = 1;
  let hasNext = true;

  while (hasNext && page <= 10) {
    body.page = page;
    const resp = await fetch("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) throw new Error(`USASpending API ${resp.status}`);
    const data = await resp.json();
    const results = data.results || [];
    allResults.push(...results);
    hasNext = data.page_metadata?.hasNext || false;
    page++;

    await delay(1000); // Rate limit
  }

  // Transform and save to awards table
  const awards = allResults
    .filter((r: any) => r["Award Amount"] > 0)
    .map((r: any) => ({
      contract_number: r["Award ID"] || "",
      fsc,
      niin: "", // USASpending doesn't give NIIN directly
      description: (r["Description"] || "").slice(0, 100),
      cage: "", // Would need CAGE lookup from recipient
      unit_price: r["Award Amount"] || 0,
      quantity: 1,
      award_date: r["Start Date"] || start,
      data_source: "usaspending_bulk",
    }));

  if (awards.length > 0) {
    for (let i = 0; i < awards.length; i += 50) {
      await supabase
        .from("usaspending_awards")
        .upsert(awards.slice(i, i + 50), { onConflict: "contract_number", ignoreDuplicates: true })
        .catch(() => {});
    }
  }

  return { fsc, period: `${start} to ${end}`, awards_found: allResults.length, saved: awards.length };
}

// --- Main processor ---

export async function POST() {
  const supabase = createServiceClient();
  const startTime = Date.now();

  // Claim jobs with fair rotation across types — 1 of each type per batch
  const jobTypes = ["supplier_discovery", "usaspending_awards", "nsn_crawl", "award_lookup"];
  const allJobs: any[] = [];
  for (const jt of jobTypes) {
    const { data } = await supabase
      .from("job_queue")
      .select("*")
      .eq("status", "pending")
      .eq("job_type", jt)
      .order("created_at", { ascending: true })
      .limit(2);
    if (data && data.length > 0) allJobs.push(...data);
  }
  const jobs = allJobs.slice(0, BATCH_SIZE);

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ processed: 0, message: "No pending jobs" });
  }

  // Mark as processing
  const ids = jobs.map((j) => j.id);
  await supabase
    .from("job_queue")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .in("id", ids);

  const results: any[] = [];

  for (const job of jobs) {
    try {
      let result;
      switch (job.job_type) {
        case "nsn_crawl":
          result = await handleNsnCrawl(job.payload);
          break;
        case "supplier_discovery":
          result = await handleSupplierDiscovery(job.payload, supabase);
          break;
        case "award_lookup":
          result = await handleAwardLookup(job.payload, supabase);
          break;
        case "usaspending_awards":
          result = await handleUsaspendingAwards(job.payload, supabase);
          break;
        default:
          throw new Error(`Unknown job type: ${job.job_type}`);
      }

      await supabase
        .from("job_queue")
        .update({
          status: "done",
          result,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      results.push({ id: job.id, status: "done", result });
    } catch (err: any) {
      const attempts = (job.attempts || 0) + 1;
      await supabase
        .from("job_queue")
        .update({
          status: attempts >= job.max_attempts ? "failed" : "pending",
          attempts,
          error_message: err.message,
        })
        .eq("id", job.id);

      results.push({ id: job.id, status: "error", error: err.message });
    }

    await delay(DELAY_MS);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  return NextResponse.json({
    processed: results.length,
    done: results.filter((r) => r.status === "done").length,
    errors: results.filter((r) => r.status === "error").length,
    elapsed_seconds: parseFloat(elapsed),
  });
}
