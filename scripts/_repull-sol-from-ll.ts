// Targeted re-pull of one sol from LL k11+k32 → DIBS dibbs_solicitations.
import "./env";
import sql from "mssql/msnodesqlv8";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const sols = process.argv.slice(2);
  if (sols.length === 0) { console.error("Usage: <sol_no> [<sol_no> ...]"); process.exit(1); }
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  for (const sol of sols) {
    const k11 = await pool.request().query(`
      SELECT k11.idnk11_k11
      FROM k10_tab k10 JOIN k11_tab k11 ON k11.idnk10_k11=k10.idnk10_k10
      WHERE LTRIM(RTRIM(k10.sol_no_k10)) = '${sol}'
    `);
    const ids = k11.recordset.map((r:any) => r.idnk11_k11);
    if (ids.length === 0) { console.log(`${sol}: not in LL`); continue; }
    const k32 = await pool.request().query(`
      SELECT idnk11_k32, itemno_k32, shptol_k32, qty_k32, dlydte_k32
      FROM k32_tab WHERE idnk11_k32 IN (${ids.join(",")})
    `);
    const ship = k32.recordset.map((r:any) => ({
      clin: String(r.itemno_k32 || "").trim() || null,
      destination: String(r.shptol_k32 || "").trim() || null,
      qty: Number(r.qty_k32) || 0,
      delivery_date: r.dlydte_k32 ? new Date(r.dlydte_k32).toISOString().slice(0,10) : null,
    }));
    const totalQty = ship.reduce((s,x) => s + x.qty, 0);
    const newQty = ship.length > 0 && totalQty > 0 ? totalQty : null;
    const update: any = { ship_to_locations: ship };
    if (newQty != null) update.quantity = newQty;
    const { error } = await sb.from("dibbs_solicitations").update(update).ilike("solicitation_number", sol);
    if (error) { console.error(`${sol}: ${error.message}`); continue; }
    console.log(`${sol}: ${ship.length} CLINs, total qty ${newQty} (was: was different)`);
  }
  await pool.close();
})();
