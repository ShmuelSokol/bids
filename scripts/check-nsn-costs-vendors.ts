import "./env";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Sample distinct vendor values from nsn_costs — are they AX vendor accounts
  // (KEHEDI, AMERIB, EMERYW...) or CAGE codes (5-char alphanumeric)?
  const { data } = await supabase
    .from("nsn_costs")
    .select("vendor, cost_source")
    .not("vendor", "is", null)
    .limit(5000);
  const distinct = new Set((data || []).map((r: any) => (r.vendor || "").trim()).filter(Boolean));
  const sorted = Array.from(distinct).sort();
  console.log(`${sorted.length} distinct vendor values in nsn_costs (first 50):`);
  for (const v of sorted.slice(0, 50)) console.log(`  "${v}"`);

  // Same for awards.bid_vendor
  const { data: a } = await supabase
    .from("awards")
    .select("bid_vendor, cage")
    .not("bid_vendor", "is", null)
    .limit(1000);
  const distinctBidV = new Set((a || []).map((r: any) => (r.bid_vendor || "").trim()).filter(Boolean));
  console.log(`\n${distinctBidV.size} distinct awards.bid_vendor values (first 30):`);
  for (const v of Array.from(distinctBidV).slice(0, 30)) console.log(`  "${v}"`);

  // Compare: awards.cage (that's the DLA CAGE of the awardee)
  const distinctCage = new Set((a || []).map((r: any) => (r.cage || "").trim()).filter(Boolean));
  console.log(`\n${distinctCage.size} distinct awards.cage values (first 10):`);
  for (const v of Array.from(distinctCage).slice(0, 10)) console.log(`  "${v}"`);
}
main().catch(console.error);
