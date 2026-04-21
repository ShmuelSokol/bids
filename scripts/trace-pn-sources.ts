import "./env";
import sql from "mssql/msnodesqlv8";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  const NSN = "6509-01-578-7887";

  console.log(`\n=== LamLinks k08_tab rows matching NIIN 01-578-7887 ===`);
  const k08 = await pool.request().query(`
    SELECT idnk08_k08, niin_k08, fsc_k08, partno_k08, p_cage_k08, p_desc_k08
    FROM k08_tab WHERE niin_k08 = '01-578-7887'
  `);
  for (const r of k08.recordset as any[]) console.log(" ", JSON.stringify(r));

  console.log(`\n=== DIBS dibbs_solicitations row for this NSN (see what fields exist for part#) ===`);
  const { data: sol } = await supabase.from("dibbs_solicitations").select("*").eq("nsn", NSN).limit(1);
  if (sol && sol[0]) {
    const row = sol[0] as any;
    const partish = Object.keys(row).filter((k) => /part|mfr|cage/i.test(k));
    console.log(`  part#-ish fields: ${partish.join(", ")}`);
    for (const k of partish) console.log(`    ${k} = ${JSON.stringify(row[k])}`);
  }

  console.log(`\n=== Is there a Master DB row for this NSN? ===`);
  const mdbUrl = "https://masterdb.everreadygroup.com/api/dibs/nsn/" + NSN.replace(/-/g, "");
  try {
    const r = await fetch(mdbUrl, { headers: { "X-Api-Key": process.env.MASTERDB_API_KEY || "dDOUwJxbhLLVQ_40H8OWRtwwER6QoFmayDiTHcQrDW8" } });
    console.log(" ", r.status, (await r.text()).slice(0, 300));
  } catch (e: any) { console.log(" ", e.message); }

  await pool.close();
}
main().catch(console.error);
