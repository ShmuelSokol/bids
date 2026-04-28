import "./env";
import sql from "mssql/msnodesqlv8";
import { createClient } from "@supabase/supabase-js";

(async () => {
  const pool = await sql.connect({ connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;" });

  // Safety: refuse if envelope already actually sent
  const envCheck = await pool.request().query(`SELECT t_stat_k33, itmcnt_k33 FROM k33_tab WHERE idnk33_k33=46896`);
  if (envCheck.recordset.length === 0) { console.log("envelope 46896 not found"); await pool.close(); return; }
  const st = String(envCheck.recordset[0].t_stat_k33 || "").trim();
  if (st === "sent") { console.log(`REFUSE: envelope 46896 already t_stat='sent' — don't delete a real transmission`); await pool.close(); return; }

  const k35 = await pool.request().query(`SELECT idnk35_k35, idnk34_k35 FROM k35_tab WHERE idnk34_k35=496228`);
  const k34 = await pool.request().query(`SELECT idnk34_k34 FROM k34_tab WHERE idnk34_k34=496228`);
  console.log(`Pre-delete: k35 rows=${k35.recordset.length}, k34 rows=${k34.recordset.length}, k33 envelope itmcnt=${envCheck.recordset[0].itmcnt_k33}`);

  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const r1 = await new sql.Request(tx).query(`DELETE FROM k35_tab WHERE idnk34_k35 = 496228`);
    const r2 = await new sql.Request(tx).query(`DELETE FROM k34_tab WHERE idnk34_k34 = 496228`);
    const r3 = await new sql.Request(tx).query(`DELETE FROM k33_tab WHERE idnk33_k33 = 46896 AND LTRIM(RTRIM(t_stat_k33)) <> 'sent'`);
    console.log(`Deleted: k35=${r1.rowsAffected?.[0]}, k34=${r2.rowsAffected?.[0]}, k33=${r3.rowsAffected?.[0]}`);
    await tx.commit();
  } catch (e: any) { try { await tx.rollback(); } catch {} throw e; }

  await pool.close();

  // Disable writeback so nothing else hits LL until REST creds land
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  await sb.from("system_settings").upsert(
    { key: "lamlinks_writeback_enabled", value: "false", description: "Paused 2026-04-24 — DIBS SQL writes cause VFP cursor errors in LL; switching to REST API once creds land" },
    { onConflict: "key" }
  );
  console.log("\n✓ writeback disabled in Supabase");

  // Also re-queue the bid for when writeback comes back, so we don't lose it
  // Actually no — user will re-post in LL. Just log it.
  console.log("\nNext: tell Abe to close LL, reopen, and re-post SPE2DS-26-T-009G at $239 natively.");
})();
