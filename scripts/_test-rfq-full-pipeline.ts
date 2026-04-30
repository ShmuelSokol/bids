/**
 * Full pipeline test:
 *   1. Insert test supplier matching a real research finding
 *   2. Generate draft → should create
 *   3. Queue for send via PATCH status='pending_send'
 *   4. Verify daemon worker picks it up + sends via EWS
 *   5. Cleanup
 *
 * Test recipient: ssokol@everreadygroup.com (your own email — safe).
 */
import "./env";
import { createClient } from "@supabase/supabase-js";
import { generateRfqDrafts } from "../src/lib/rfq-draft-generator";

const TEST_EMAIL = "ssokol@everreadygroup.com";
const TEST_SUPPLIER_NAME = "Grainger Industrial Supply";

(async () => {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  console.log("=== Step 1: Find a real research finding for Grainger ===");
  const { data: findings } = await sb
    .from("nsn_research_findings")
    .select("nsn, supplier_name")
    .eq("supplier_name", TEST_SUPPLIER_NAME)
    .eq("superseded", false)
    .limit(1);
  const testNsn = findings?.[0]?.nsn;
  if (!testNsn) {
    console.log("No Grainger finding — using fallback NSN");
  }
  console.log(`  Using NSN: ${testNsn || "5999-01-068-2590"} (Grainger supplier)`);

  console.log("\n=== Step 2: Insert/upsert test supplier with safe email ===");
  // First clean up any prior test
  await sb.from("dibs_suppliers").delete()
    .eq("name", TEST_SUPPLIER_NAME)
    .eq("source", "manual");

  const { data: testSup, error: insErr } = await sb
    .from("dibs_suppliers")
    .insert({
      name: TEST_SUPPLIER_NAME,
      email: TEST_EMAIL,
      source: "manual",
      confidence: 1.0,
      notes: "TEST SUPPLIER — DO NOT REMOVE WITHOUT CHECKING (e2e test)",
    })
    .select()
    .single();
  if (insErr) {
    console.error(`  insert err: ${insErr.message}`);
    process.exit(1);
  }
  console.log(`  ✓ Inserted test supplier id=${testSup.id} email=${testSup.email}`);

  console.log("\n=== Step 3: Generate draft ===");
  const result = await generateRfqDrafts({
    needs: [{ nsn: testNsn || "5999-01-068-2590", qty: 1 }],
    source: "manual",
    createdBy: "e2e-test",
  });
  console.log(`  Result: created=${result.draftsCreated}, skipped=${result.skipped}`);
  if (result.draftsCreated === 0) {
    console.log(`  ⚠ No draft created — details:`, JSON.stringify(result.details, null, 2));
    // Cleanup test supplier
    await sb.from("dibs_suppliers").delete().eq("id", testSup.id);
    process.exit(1);
  }

  // Find the draft we just created
  const { data: draft } = await sb
    .from("rfq_drafts")
    .select("*")
    .eq("supplier_id", testSup.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!draft) {
    console.error("  ⚠ Draft not found in DB after generate");
    process.exit(1);
  }
  console.log(`  ✓ Draft #${draft.id} status=${draft.status}`);
  console.log(`    Subject: ${draft.subject}`);
  console.log(`    Body preview: ${draft.body.slice(0, 200)}...`);

  console.log("\n=== Step 4: Queue for send (status: draft → pending_send) ===");
  const { error: updErr } = await sb
    .from("rfq_drafts")
    .update({ status: "pending_send" })
    .eq("id", draft.id);
  if (updErr) { console.error(`  upd err: ${updErr.message}`); process.exit(1); }
  console.log(`  ✓ Queued for send`);

  console.log("\n=== Step 5: Wait for daemon worker (poll up to 90 sec) ===");
  let final: any = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((res) => setTimeout(res, 3000));
    const { data: cur } = await sb
      .from("rfq_drafts")
      .select("status, sent_at, send_error")
      .eq("id", draft.id)
      .maybeSingle();
    process.stdout.write(`  [${i * 3}s] status=${cur?.status}\r`);
    if (cur?.status === "sent" || cur?.status === "send_failed") {
      final = cur;
      console.log(`\n  ✓ Reached terminal state: ${cur.status}`);
      if (cur.send_error) console.log(`    Error: ${cur.send_error}`);
      if (cur.sent_at) console.log(`    Sent at: ${cur.sent_at}`);
      break;
    }
  }
  if (!final) {
    console.log(`\n  ⚠ Daemon didn't process within 90s — daemon may not be running`);
  }

  console.log("\n=== Cleanup ===");
  // Delete the test draft + test supplier
  await sb.from("rfq_drafts").delete().eq("id", draft.id);
  await sb.from("dibs_suppliers").delete().eq("id", testSup.id);
  console.log(`  ✓ Cleaned up test supplier + draft`);

  console.log("\n=== Test result ===");
  if (final?.status === "sent") {
    console.log(`✅ PIPELINE WORKING: draft → queue → daemon → EWS sent`);
    console.log(`   Check ${TEST_EMAIL} inbox for the test RFQ.`);
  } else if (final?.status === "send_failed") {
    console.log(`⚠ Daemon ran but EWS send failed`);
    console.log(`   Error: ${final.send_error}`);
  } else {
    console.log(`⚠ Daemon didn't pick it up — check that send-rfq-drafts is running`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
