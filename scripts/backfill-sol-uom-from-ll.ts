/**
 * Backfill dibbs_solicitations.sol_uom from LL k11.sol_um_k11.
 * Run after applying scripts/sql/dibbs-sol-uom.sql.
 */
import "./env";
import sql from "mssql/msnodesqlv8";
import { createClient } from "@supabase/supabase-js";

(async () => {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // Pull all LL sol→uom mappings in one go
  console.log("Pulling LL sol UoMs...");
  const r = await pool.request().query(`
    SELECT LTRIM(RTRIM(k10.sol_no_k10)) AS sol_no, LTRIM(RTRIM(k11.sol_um_k11)) AS uom
    FROM k10_tab k10 INNER JOIN k11_tab k11 ON k11.idnk10_k11 = k10.idnk10_k10
    WHERE k11.sol_um_k11 IS NOT NULL AND LEN(LTRIM(RTRIM(k11.sol_um_k11))) > 0
  `);
  const map = new Map<string, string>();
  for (const row of r.recordset) {
    if (!map.has(row.sol_no)) map.set(row.sol_no, row.uom);
  }
  console.log(`  ${map.size.toLocaleString()} LL sol→uom mappings`);

  // Pull all DIBS sourceable sols
  console.log("\nPulling DIBS sols...");
  let page = 0; let total = 0; let updated = 0; let unchanged = 0; let noLL = 0;
  while (true) {
    const { data } = await sb
      .from("dibbs_solicitations")
      .select("id, solicitation_number, sol_uom")
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    total += data.length;

    // Build update batch
    const updates: { id: number; sol_uom: string }[] = [];
    for (const row of data) {
      const llUom = map.get(row.solicitation_number);
      if (!llUom) { noLL++; continue; }
      if (row.sol_uom === llUom) { unchanged++; continue; }
      updates.push({ id: row.id, sol_uom: llUom });
    }

    // Apply updates one-by-one (Supabase upsert needs PK conflict, simpler to update)
    for (const u of updates) {
      await sb.from("dibbs_solicitations").update({ sol_uom: u.sol_uom }).eq("id", u.id);
      updated++;
    }
    if (data.length < 1000) break;
    page++;
  }
  console.log(`\nTotal sols scanned: ${total.toLocaleString()}`);
  console.log(`  ${updated.toLocaleString()} updated with sol_uom from LL`);
  console.log(`  ${unchanged.toLocaleString()} already correct`);
  console.log(`  ${noLL.toLocaleString()} not found in LL k11`);

  await pool.close();
})().catch((e) => { console.error(e); process.exit(1); });
