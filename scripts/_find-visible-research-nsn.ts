import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

(async () => {
  const todayIso = new Date().toISOString().split("T")[0];

  // Get NSNs with research results (idle + candidates > 0)
  const { data: researched } = await sb
    .from("nsn_research_status")
    .select("nsn, candidate_count, top_supplier_name, any_erg_account, top_confidence")
    .eq("queue_status", "idle")
    .gt("candidate_count", 0)
    .order("any_erg_account", { ascending: false })
    .order("top_confidence", { ascending: false })
    .limit(100);

  if (!researched?.length) { console.log("no researched nsns"); return; }
  console.log(`Total researched NSNs: ${researched.length}`);

  const nsns = researched.map(r => r.nsn);
  // Find which of these have an OPEN, SPE*, non-bid sol today
  const { data: sols } = await sb
    .from("dibbs_solicitations")
    .select("nsn, solicitation_number, is_sourceable, already_bid, return_by_date_iso, quantity, file_reference")
    .in("nsn", nsns)
    .gte("return_by_date_iso", todayIso);

  const visible = (sols || []).filter((s: any) =>
    s.solicitation_number?.trim().toUpperCase().startsWith("SPE") &&
    !s.already_bid
  );
  console.log(`Visible (SPE* + open + not bid) sols w/ research: ${visible.length}`);

  // Map back to research info
  const rMap = new Map(researched.map(r => [r.nsn, r]));
  console.log("\nTop 10 picks — both sourceable and non-sourceable:");
  console.log("NSN                    Sol                      Src  Qty   Cands  ERGacct  TopSupplier");
  for (const s of visible.slice(0, 15)) {
    const r = rMap.get(s.nsn)!;
    console.log(
      `${s.nsn.padEnd(22)} ${s.solicitation_number.padEnd(24)} ${s.is_sourceable ? "yes" : "no "}   ${String(s.quantity).padStart(4)}  ${String(r.candidate_count).padStart(4)}   ${r.any_erg_account ? "Y" : "n"}        ${(r.top_supplier_name || "").slice(0, 35)}`
    );
  }
})();
