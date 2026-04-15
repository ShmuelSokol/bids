/**
 * Test 3: Award detection loop.
 *
 * Verify that when Abe wins a bid, the award lands in our `awards` table
 * and can be traced back to the original `bid_decisions` row.
 *
 * What this checks:
 *   - How many recent awards have a DIBBS contract_number that LOOKS like
 *     it came from a DIBS-submitted bid (matching sol# prefix)
 *   - Whether we can match awards → bid_decisions by (fsc, niin, ~date)
 *   - How stale the awards table is vs LamLinks k81_tab
 *   - Whether DIBS "knows" it won anything
 *
 *   npx tsx scripts/test-award-detection.ts
 */
import "./env";
import sql from "mssql/msnodesqlv8";
import { createClient } from "@supabase/supabase-js";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("=== AWARD DETECTION TEST ===\n");

  // 1. Freshness check — how current is the awards table?
  const { data: newestAward } = await sb
    .from("awards")
    .select("award_date, updated_at, cage")
    .eq("cage", "0AG09")
    .order("award_date", { ascending: false })
    .limit(1);
  const newest = newestAward?.[0];
  console.log("1. Awards table freshness (our wins only):");
  console.log(`   Most recent award_date: ${newest?.award_date || "NONE"}`);
  console.log(`   Row last touched:       ${newest?.updated_at || "NONE"}`);

  // 2. LamLinks k81 freshness — where the awards come from
  const pool = await sql.connect(config);
  const k81Fresh = await pool.request().query(`
    SELECT TOP 5
      k81.addtme_k81 AS award_date,
      k79.cntrct_k79 AS contract_number,
      k08.fsc_k08 AS fsc,
      k08.niin_k08 AS niin
    FROM k81_tab k81
    JOIN k80_tab k80 ON k80.idnk80_k80 = k81.idnk80_k81
    JOIN k79_tab k79 ON k79.idnk79_k79 = k80.idnk79_k80
    LEFT JOIN k11_tab k11 ON k11.idnk11_k11 = k81.idnk71_k81
    LEFT JOIN k08_tab k08 ON k08.idnk08_k08 = k11.idnk08_k11
    WHERE k08.fsc_k08 IS NOT NULL
    ORDER BY k81.addtme_k81 DESC
  `);
  console.log(`\n2. LamLinks k81 newest 5 awards:`);
  for (const r of k81Fresh.recordset) {
    console.log(`   ${r.award_date?.toISOString?.().slice(0, 10)} ${r.contract_number} ${r.fsc}-${r.niin}`);
  }
  const lamLinksNewestDate = k81Fresh.recordset[0]?.award_date;
  const supabaseNewestDate = newest?.award_date ? new Date(newest.award_date) : null;
  if (lamLinksNewestDate && supabaseNewestDate) {
    const gapDays = Math.round(
      (lamLinksNewestDate.getTime() - supabaseNewestDate.getTime()) / 86_400_000
    );
    console.log(`   Gap: LamLinks is ${gapDays}d ahead of Supabase awards table`);
    if (gapDays > 2) console.log(`   ⚠️  Gap > 2 days — nightly import may be stale or broken`);
  }

  // 3. Trace bid_decisions → awards. How many 'submitted' bids have a
  //    matching award in our table? This is the real question.
  const { data: submittedBids } = await sb
    .from("bid_decisions")
    .select("solicitation_number, nsn, status, final_price, updated_at")
    .eq("status", "submitted")
    .order("updated_at", { ascending: false })
    .limit(20);

  console.log(`\n3. Recent submitted bid_decisions (${submittedBids?.length || 0}):`);
  if (!submittedBids?.length) {
    console.log(`   NONE — nothing's been marked 'submitted' yet. Expected until --execute runs.`);
  } else {
    let matched = 0;
    for (const b of submittedBids) {
      const [fsc, ...niinParts] = (b.nsn || "").split("-");
      const niin = niinParts.join("-");
      const { data: award } = await sb
        .from("awards")
        .select("contract_number, unit_price, award_date, cage")
        .eq("fsc", fsc)
        .eq("niin", niin)
        .gte("award_date", b.updated_at) // award must be AFTER we submitted
        .order("award_date", { ascending: true })
        .limit(1);
      const a = award?.[0];
      const status = a?.cage?.trim() === "0AG09" ? "✓ WON" : a ? `✗ lost to ${a.cage?.trim()} @ $${a.unit_price}` : "? pending";
      if (a?.cage?.trim() === "0AG09") matched++;
      console.log(`   ${b.solicitation_number} / ${b.nsn} @ $${b.final_price} → ${status}`);
    }
    console.log(`\n   Win rate on submitted: ${matched}/${submittedBids.length}`);
  }

  // 4. Reverse — awards in last 30 days that look like they originated
  //    from DIBBS solicitations we tracked. If DIBS never staged a
  //    bid_decisions row for them, that's a gap in the pipeline.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: recentWins } = await sb
    .from("awards")
    .select("contract_number, fsc, niin, unit_price, award_date")
    .eq("cage", "0AG09")
    .gte("award_date", thirtyDaysAgo)
    .order("award_date", { ascending: false })
    .limit(20);
  console.log(`\n4. Our wins in last 30 days (${recentWins?.length || 0}):`);
  if (recentWins?.length) {
    for (const a of recentWins.slice(0, 5)) {
      const { data: bid } = await sb
        .from("bid_decisions")
        .select("solicitation_number, final_price, status")
        .eq("nsn", `${a.fsc}-${a.niin}`)
        .limit(1);
      const tag = bid?.[0] ? `→ bid_decisions row (${bid[0].status})` : `→ NO bid_decisions row (win came from outside DIBS)`;
      console.log(`   ${a.contract_number} ${a.fsc}-${a.niin} @ $${a.unit_price} ${tag}`);
    }
  }

  await pool.close();

  console.log("\n=== SUMMARY ===");
  console.log("What's verified:");
  console.log("  - awards table freshness vs LamLinks source of truth");
  console.log("  - bid_decisions → awards match rate for submitted bids");
  console.log("  - orphan wins (we won but DIBS never tracked the bid)");
  console.log("\nWhat's NOT verified (needs a real submitted-through-win cycle):");
  console.log("  - DIBBS EDI round-trip latency");
  console.log("  - k33.t_stat_k33 transition from 'acknowledged' → 'sent'");
  console.log("  - award_lookup job timing (or whether it exists at all)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
