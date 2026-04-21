// After moving our 2 posted orphans down into historical gaps, the
// bid_decisions.comment strings we wrote earlier ("Transmitted via LamLinks
// k34=495751" and "k34=495752") are now stale references. Repoint them to
// the new ids so future audits don't see phantom k34 numbers.

import "./env";
import { createClient } from "@supabase/supabase-js";

const UPDATES = [
  { sol: "SPE2DP-26-T-2975", nsn: "6509-01-578-7887", oldId: 495751, newId: 123621 },
  { sol: "SPE2DS-26-T-9795", nsn: "6515-01-215-4177", oldId: 495752, newId: 123622 },
];

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  for (const u of UPDATES) {
    const newComment = `Transmitted via LamLinks k34=${u.newId} (moved from ${u.oldId} to clear Abe's client-counter path — see docs/lamlinks-writeback.md)`;
    const { data, error } = await supabase
      .from("bid_decisions")
      .update({ comment: newComment, updated_at: new Date().toISOString() })
      .eq("solicitation_number", u.sol)
      .eq("nsn", u.nsn)
      .select("id, solicitation_number, comment");
    if (error) { console.log(`✗ ${u.sol}: ${error.message}`); continue; }
    console.log(`✓ ${u.sol}: ${data?.length || 0} row updated`);
    for (const r of data || []) console.log(`    comment="${r.comment}"`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
