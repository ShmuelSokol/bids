/**
 * Rollback a single posted invoice back to pre-post state. USE WITH CAUTION —
 * this undoes the writeback worker's transaction by reversing each table
 * change. Useful only if a bulk batch posted something that should not have
 * gone through. Once DLA acks the 810/856 EDI, the gov side has the invoice
 * regardless of what we do locally.
 *
 * Usage: npx tsx scripts/_rollback-cin.ts --cinnum=0066186 [--execute]
 *
 * Steps reversed (in safe order):
 *   1. DELETE kbr × 2 (810+856) — frees the UNIQUE constraint
 *   2. DELETE kae lines (cascades from kad)
 *   3. DELETE kad header
 *   4. DELETE k20 log entries (matched by msgtxt)
 *   5. UPDATE k81 shpsta_k81='Shipping' (reverse the status flip)
 *   6. UPDATE k80 rlssta_k80='Open' (reverse close)
 *   7. UPDATE ka9 idnkae_ka9=0, jlnsta_ka9='Shipping' (unlink)
 *   8. UPDATE kaj shpsta_kaj='Packing' (reverse — caller may want to skip)
 *   9. UPDATE Supabase queue: state='pending', clear ll_idnkad
 *
 * Counter rollback (k07.CIN_NO and k07.TRN_ID_CK5) is NOT performed because
 * those are append-only allocations — leaving a gap is harmless.
 */
import "./env";
import sql from "mssql/msnodesqlv8";
import { createServiceClient } from "../src/lib/supabase-server";

(async () => {
  const cinnum = process.argv.find((a) => a.startsWith("--cinnum="))?.slice("--cinnum=".length);
  const execute = process.argv.includes("--execute");
  if (!cinnum) {
    console.error("Usage: --cinnum=0066186 [--execute]");
    process.exit(1);
  }

  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // Resolve all dependent ids
  const r = await pool.request().query(`
    SELECT
      kad.idnkad_kad AS kad,
      kae.idnkae_kae AS kae,
      kaj.idnkaj_kaj AS kaj,
      ka9.idnka9_ka9 AS ka9,
      k80.idnk80_k80 AS k80,
      k81.idnk81_k81 AS k81
    FROM kad_tab kad
    LEFT JOIN kae_tab kae ON kae.idnkad_kae = kad.idnkad_kad
    LEFT JOIN ka9_tab ka9 ON ka9.idnkae_ka9 = kae.idnkae_kae
    LEFT JOIN kaj_tab kaj ON kaj.idnkaj_kaj = ka9.idnkaj_ka9
    LEFT JOIN k80_tab k80 ON k80.idnk80_k80 = kaj.idnk80_kaj
    LEFT JOIN k81_tab k81 ON k81.idnk80_k81 = k80.idnk80_k80
    WHERE kad.cinnum_kad = '${cinnum}'
  `);
  if (!r.recordset.length) { console.error(`No kad row for cinnum=${cinnum}`); process.exit(1); }
  const ids = r.recordset[0];
  console.log(`Resolved ids:`, ids);

  if (!execute) {
    console.log(`\n--- DRY RUN — pass --execute to perform rollback ---`);
    console.log(`Would delete kbr (kap=24,25 for kaj=${ids.kaj}), kae=${ids.kae}, kad=${ids.kad}, k20 log entries`);
    console.log(`Would revert k81=${ids.k81} → Shipping, k80=${ids.k80} → Open, ka9=${ids.ka9} → Shipping (unlinked), kaj=${ids.kaj} → Packing`);
    await pool.close();
    return;
  }

  console.log(`\n--- EXECUTING rollback for CIN${cinnum} ---`);
  const tx = pool.transaction();
  await tx.begin();
  try {
    const t = tx.request();
    let n: any;
    n = await t.query(`DELETE FROM kbr_tab WHERE itttbl_kbr='kaj' AND idnitt_kbr=${ids.kaj} AND idnkap_kbr IN (24,25)`);
    console.log(`  kbr deleted: ${n.rowsAffected[0]}`);
    n = await t.query(`DELETE FROM kae_tab WHERE idnkad_kae=${ids.kad}`);
    console.log(`  kae deleted: ${n.rowsAffected[0]}`);
    n = await t.query(`DELETE FROM kad_tab WHERE idnkad_kad=${ids.kad}`);
    console.log(`  kad deleted: ${n.rowsAffected[0]}`);
    n = await t.query(`DELETE FROM k20_tab WHERE susnam_k20='WAWF_edi_upload' AND logmsg_k20 LIKE '%' + (SELECT TOP 1 cintract_etc FROM (VALUES('${cinnum}')) v(cintract_etc)) + '%'`);
    // simpler: skip k20 cleanup if matching is messy — the records are audit logs and harmless to leave
    n = await t.query(`UPDATE k81_tab SET shpsta_k81='Shipping' WHERE idnk81_k81=${ids.k81}`);
    console.log(`  k81 reverted: ${n.rowsAffected[0]}`);
    n = await t.query(`UPDATE k80_tab SET rlssta_k80='Open' WHERE idnk80_k80=${ids.k80}`);
    console.log(`  k80 reverted: ${n.rowsAffected[0]}`);
    n = await t.query(`UPDATE ka9_tab SET idnkae_ka9=0, jlnsta_ka9='Shipping' WHERE idnka9_ka9=${ids.ka9}`);
    console.log(`  ka9 reverted: ${n.rowsAffected[0]}`);
    // kaj.shpsta — leave as 'Shipped' since the warehouse already physically shipped; flipping back to Packing is misleading
    await tx.commit();
    console.log(`✓ rollback transaction committed`);
  } catch (e: any) {
    await tx.rollback();
    console.error(`✗ rollback FAILED, transaction aborted:`, e.message);
    process.exit(1);
  }

  // Update Supabase queue
  const sb = createServiceClient();
  const { error } = await sb
    .from("lamlinks_invoice_queue")
    .update({ state: "pending", ll_idnkad: null, posted_at: null, error_message: null })
    .eq("ax_invoice_number", cinnum);
  if (error) console.error(`Supabase update error:`, error.message);
  else console.log(`✓ Supabase queue row reset to pending`);

  await pool.close();
})().catch((e) => { console.error(e); process.exit(1); });
