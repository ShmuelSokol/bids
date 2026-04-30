/**
 * End-to-end test for the RFQ pipeline:
 *   1. Find an NSN that has research findings AND has known suppliers
 *      with email in dibs_suppliers (rare but possible — most research
 *      suppliers won't be in dibs yet)
 *   2. If none, just pick any NSN with research findings — we'll see
 *      the "no_email" skip rate
 *   3. Call generateRfqDrafts directly
 *   4. Show the result + check the rfq_drafts table state
 */
import "./env";
import { createClient } from "@supabase/supabase-js";
import { generateRfqDrafts } from "../src/lib/rfq-draft-generator";

(async () => {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Find best test candidates: NSNs where one of the research suppliers has a CAGE
  // matching a dibs_suppliers row with an email (or supplier name matches)
  console.log("Looking for test candidates...");
  const { data: cands } = await sb
    .from("nsn_research_findings")
    .select("nsn, supplier_name, supplier_cage, list_price, confidence")
    .eq("superseded", false)
    .gte("confidence", 0.6)
    .limit(50);
  console.log(`Sampled ${cands?.length || 0} research findings`);

  // Pull our suppliers
  const { data: sups } = await sb
    .from("dibs_suppliers")
    .select("name, cage, email")
    .not("email", "is", null);
  const supByCage = new Set((sups || []).filter((s: any) => s.cage).map((s: any) => s.cage.toUpperCase()));
  const supByName = new Set((sups || []).map((s: any) => s.name.toLowerCase()));

  // Find an NSN that has at least one matching supplier
  const goodCandidate = (cands || []).find((c: any) =>
    (c.supplier_cage && supByCage.has(c.supplier_cage.toUpperCase())) ||
    supByName.has(c.supplier_name.toLowerCase())
  );

  if (goodCandidate) {
    console.log(`\n✓ Found candidate WITH supplier match: NSN=${goodCandidate.nsn} supplier=${goodCandidate.supplier_name} cage=${goodCandidate.supplier_cage}`);
  } else {
    console.log(`\n⚠ No candidate has a matching dibs_suppliers row. Will test with any NSN — expect 'no_email' skip.`);
  }

  const testNsn = goodCandidate?.nsn || (cands?.[0]?.nsn) || "6510-01-697-2974";
  console.log(`\nUsing NSN ${testNsn} for test`);

  const result = await generateRfqDrafts({
    needs: [{ nsn: testNsn, qty: 25 }],
    source: "manual",
    createdBy: "e2e-test",
  });
  console.log("\n=== Generator result ===");
  console.log(JSON.stringify(result, null, 2));

  // Check rfq_drafts table state
  const { count } = await sb.from("rfq_drafts").select("*", { count: "exact", head: true });
  console.log(`\nrfq_drafts total rows: ${count}`);

  const { data: recent } = await sb
    .from("rfq_drafts")
    .select("id, status, supplier_email, supplier_name, subject, lines")
    .order("created_at", { ascending: false })
    .limit(5);
  console.log(`Recent 5:`);
  for (const r of recent || []) {
    console.log(`  #${r.id} [${r.status}] → ${r.supplier_email}: ${r.subject}`);
    console.log(`    Lines: ${JSON.stringify(r.lines).slice(0, 100)}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
