import "./env";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const WRONG_NSN = "6509-01-578-7887";  // what Abe was asked to bid on
  const RIGHT_NSN = "6509-01-565-5348";  // the NSN that 08711278 actually belongs to
  const WRONG_PN = "08711278";           // what we populated
  const CORRECT_PN = "083018";           // what it should be
  const CORRECT_CAGE = "4PG41";

  console.log(`\n=== DIBS sol row for ${WRONG_NSN} ===`);
  const { data: sol } = await supabase.from("dibbs_solicitations").select("*").eq("nsn", WRONG_NSN);
  for (const r of sol || []) {
    console.log(`  sol=${r.solicitation_number}  nomen="${r.nomenclature}"  source=${r.source}  source_item=${r.source_item}`);
    console.log(`  cost=${r.our_cost}  cost_src="${r.cost_source}"  suggested=${r.suggested_price}  price_src="${r.price_source}"`);
  }

  console.log(`\n=== nsn_matches rows for ${WRONG_NSN} ===`);
  const { data: nm } = await supabase.from("nsn_matches").select("*").eq("nsn", WRONG_NSN);
  for (const r of nm || []) console.log(" ", JSON.stringify(r));

  console.log(`\n=== nsn_catalog row for ${WRONG_NSN} (AX — authoritative) ===`);
  const { data: cat } = await supabase.from("nsn_catalog").select("*").eq("nsn", WRONG_NSN);
  for (const r of cat || []) console.log(" ", JSON.stringify(r));

  console.log(`\n=== Where does ${WRONG_PN} appear? (all tables) ===`);
  for (const tbl of ["nsn_matches", "nsn_catalog", "dibbs_solicitations"]) {
    for (const col of ["matched_part_number", "source_item", "mfr_part_number", "part_number"]) {
      try {
        const { data } = await supabase.from(tbl).select("nsn").eq(col, WRONG_PN).limit(5);
        if (data && data.length > 0) {
          console.log(`  ${tbl}.${col} = "${WRONG_PN}" → NSNs: ${data.map((r: any) => r.nsn).join(", ")}`);
        }
      } catch (e) { /* column doesn't exist */ }
    }
  }

  console.log(`\n=== nsn_matches / nsn_catalog rows for the ACTUAL-owner NSN ${RIGHT_NSN} ===`);
  const { data: nm2 } = await supabase.from("nsn_matches").select("*").eq("nsn", RIGHT_NSN);
  for (const r of nm2 || []) console.log(" ", JSON.stringify(r));
  const { data: cat2 } = await supabase.from("nsn_catalog").select("*").eq("nsn", RIGHT_NSN);
  for (const r of cat2 || []) console.log(" ", JSON.stringify(r));

  console.log(`\n=== Any DIBS sol for ${RIGHT_NSN}? ===`);
  const { data: sol2 } = await supabase.from("dibbs_solicitations").select("solicitation_number, nomenclature").eq("nsn", RIGHT_NSN).limit(3);
  for (const r of sol2 || []) console.log(" ", JSON.stringify(r));

  console.log(`\n=== Does the CORRECT PN (${CORRECT_PN} / CAGE ${CORRECT_CAGE}) appear anywhere? ===`);
  for (const tbl of ["nsn_matches", "nsn_catalog"]) {
    for (const col of ["matched_part_number", "mfr_part_number", "part_number"]) {
      try {
        const { data } = await supabase.from(tbl).select("nsn").eq(col, CORRECT_PN).limit(5);
        if (data && data.length > 0) {
          console.log(`  ${tbl}.${col} = "${CORRECT_PN}" → NSNs: ${data.map((r: any) => r.nsn).join(", ")}`);
        }
      } catch (e) {}
    }
  }
}
main().catch(console.error);
