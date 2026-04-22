// Single-invoice write-back test.
//
// Given a DIBS invoice identity (typically an award id + qty + unit price from
// /invoicing), this builds the kad + kae rows and prints the plan. With
// --execute, it actually inserts them inside a transaction, using SQL Server
// IDENTITY auto-allocation for both ids (grabs the new PKs via OUTPUT).
//
// Morning test protocol (2026-04-22):
//   1. Yosef posts one real invoice in LamLinks with `tail-invoice-chain.ts`
//      running in another terminal. We observe the exact write sequence.
//   2. Pick a DIFFERENT real shipment we haven't invoiced yet.
//   3. Run this script in dry-run. Yosef looks at the SQL.
//   4. Run --execute. Verify row appears in LamLinks UI identical to his.
//   5. Yosef clicks Post on it. Confirm it flips to 'Posted' and transmits
//      (EDI-to-DIBBS is the only downstream consumer — no AX involvement
//      per Yosef, so we only watch for the state flip).
//
// Usage:
//   npx tsx scripts/test-invoice-writeback.ts --award-id=12345   (dry run)
//   npx tsx scripts/test-invoice-writeback.ts --award-id=12345 --execute

import "./env";
import sql from "mssql/msnodesqlv8";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes("--execute");
  const awardArg = args.find((a) => a.startsWith("--award-id="));
  const overrideCinNo = args.find((a) => a.startsWith("--cin-no="))?.split("=")[1];
  if (!awardArg) {
    console.error("Usage: --award-id=<dibs awards.id> [--cin-no=<invoice number>] [--execute]");
    process.exit(2);
  }
  const awardId = Number(awardArg.split("=")[1]);

  // Pull award from DIBS
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: award, error } = await sb
    .from("awards")
    .select("id, fsc, niin, contract_number, award_date, unit_price, quantity, description, cage")
    .eq("id", awardId)
    .single();
  if (error || !award) {
    console.error(`Award id=${awardId} not found in DIBS: ${error?.message}`);
    process.exit(2);
  }
  console.log(`DIBS award:`);
  console.log(`  id=${award.id}  contract=${award.contract_number}  NSN=${award.fsc}-${award.niin}`);
  console.log(`  qty=${award.quantity}  unit_price=$${award.unit_price}  awarded=${award.award_date}`);

  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // Find the ka9 line(s) that fulfilled this award — via k81 linkage.
  // k81_tab.piidno_k81 matches the contract number; we navigate back.
  // A more robust path is contract+niin but we'll start with contract lookup.
  const lookup = await pool.request().query(`
    SELECT k81.idnk81_k81, k81.idnk80_k81, k81.idnk71_k81,
           k80.piidno_k80,
           ka9.idnka9_ka9, ka9.idnk81_ka9, ka9.idnkaj_ka9, ka9.idnk71_ka9,
           ka9.idnkae_ka9 AS existing_idnkae_ka9,
           kaj.idnkaj_kaj, ka8.idnka8_ka8
    FROM k81_tab k81
    INNER JOIN k80_tab k80 ON k81.idnk80_k81 = k80.idnk80_k80
    LEFT JOIN ka9_tab ka9 ON ka9.idnk81_ka9 = k81.idnk81_k81
    LEFT JOIN kaj_tab kaj ON kaj.idnkaj_kaj = ka9.idnkaj_ka9
    LEFT JOIN ka8_tab ka8 ON ka8.idnka8_ka8 = ka9.idnka8_ka9
    WHERE LTRIM(RTRIM(k80.piidno_k80)) = '${award.contract_number?.trim()}'
  `);
  if (lookup.recordset.length === 0) {
    console.log(`\n⚠ No ka9 rows found for contract "${award.contract_number}".`);
    console.log(`  Either the shipment hasn't been fulfilled yet (warehouse hasn't created ka9 for it),`);
    console.log(`  or the contract link query needs refinement. Can't invoice a line that doesn't have`);
    console.log(`  a fulfilment record yet.`);
    await pool.close();
    process.exit(2);
  }

  console.log(`\nFound ${lookup.recordset.length} ka9 line(s) for this contract:`);
  const lines = [];
  for (const r of lookup.recordset as any[]) {
    const alreadyInvoiced = r.existing_idnkae_ka9 > 0;
    console.log(`  ka9=${r.idnka9_ka9}  ka8=${r.idnka8_ka8}  kaj=${r.idnkaj_kaj}  k81=${r.idnk81_k81}${alreadyInvoiced ? `  [ALREADY INVOICED as kae=${r.existing_idnkae_ka9}]` : ""}`);
    if (!alreadyInvoiced) lines.push(r);
  }
  if (lines.length === 0) {
    console.log(`\n⚠ All ka9 lines for this contract are already invoiced. Nothing to do.`);
    await pool.close();
    process.exit(0);
  }

  // Look up the right idnk31 (customer) for this contract.
  // Contract prefix first 6 chars → a_code_k31 match.
  const contractPrefix = award.contract_number?.trim().slice(0, 6);
  const k31Lookup = await pool.request().query(`
    SELECT TOP 1 idnk31_k31, a_code_k31, c_name_k31
    FROM k31_tab
    WHERE LTRIM(RTRIM(a_code_k31)) = '${contractPrefix}'
  `);
  const idnk31 = k31Lookup.recordset[0]?.idnk31_k31 || 203; // fall back to DoD
  console.log(`\nCustomer (k31) resolution:`);
  console.log(`  contract prefix "${contractPrefix}" → idnk31=${idnk31} ${k31Lookup.recordset[0] ? `(${k31Lookup.recordset[0].c_name_k31})` : "(fallback to DoD)"}`);

  // Resolve cin_no (invoice number). If not provided, next would be MAX+1 on
  // cin_no_kad. The warehouse typically pre-generates these; for now let the
  // caller pass one or we compute a safe next.
  let cinNo: string;
  if (overrideCinNo) {
    cinNo = overrideCinNo;
  } else {
    const maxCin = await pool.request().query(`
      SELECT TOP 1 cin_no_kad FROM kad_tab WHERE cin_no_kad LIKE '[0-9]%' ORDER BY idnkad_kad DESC
    `);
    const lastCin = maxCin.recordset[0]?.cin_no_kad?.trim();
    const nextCin = lastCin ? (Number(lastCin) + 1).toString() : "900000";
    cinNo = nextCin;
  }
  console.log(`  invoice number (cin_no_kad) = "${cinNo}" ${overrideCinNo ? "(user-provided)" : "(auto-incremented)"}`);

  // Build per-line totals
  const unitPrice = Number(award.unit_price);
  const qty = Number(award.quantity);
  const lineExt = Math.round(unitPrice * qty * 100) / 100;
  const invoiceTotal = lineExt * lines.length; // one extension per ka9 line — refine if lines differ
  console.log(`\nFinancials:`);
  console.log(`  unit_price=$${unitPrice}  qty=${qty}  line_ext=$${lineExt}  invoice_total=$${invoiceTotal}`);

  // Build the plan
  console.log(`\n=== PLAN ===`);
  console.log(`INSERT kad (1 row) — idnkad auto-allocated by IDENTITY`);
  console.log(`  cinsta_kad = 'Not Posted     ' (draft state)`);
  console.log(`  cin_no_kad = '${cinNo}'`);
  console.log(`  cinnum_kad = 'S0${cinNo}'  (prefix S0 matches warehouse pattern)`);
  console.log(`  idnk31_kad = ${idnk31}`);
  console.log(`  idnk06_kad = 1           (Net 30 default)`);
  console.log(`  mslval_kad = ${invoiceTotal}`);
  console.log(`  ar_val_kad = ${invoiceTotal}`);
  console.log(`  (all other value fields = 0)`);
  console.log(`  cisdte_kad = GETDATE()   (creation date)`);
  console.log(`  cindte_kad = GETDATE()   (invoice date)`);
  console.log(`  upname_kad = 'ajoseph   '`);

  console.log(`\nINSERT kae (${lines.length} rows) — idnkae auto-allocated by IDENTITY`);
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    console.log(`  line ${i + 1}:`);
    console.log(`    idnkad_kae = <new kad id>`);
    console.log(`    cilcls_kae = 'Material  '`);
    console.log(`    cil_no_kae = ${i + 1}`);
    console.log(`    cildes_kae = "${(award.description || "").slice(0, 40)}"`);
    console.log(`    cilqty_kae = ${qty}`);
    console.log(`    cil_up_kae = ${unitPrice}`);
    console.log(`    cil_ui_kae = 'EA'`);
    console.log(`    cilext_kae = ${lineExt}`);
  }

  console.log(`\nUPDATE ka9 (${lines.length} rows) — link each ka9 line to its new kae`);
  for (const L of lines) {
    console.log(`  UPDATE ka9_tab SET idnkae_ka9 = <new kae id> WHERE idnka9_ka9 = ${L.idnka9_ka9}`);
  }

  if (!execute) {
    console.log(`\nDRY RUN. Re-run with --execute to perform the inserts.`);
    console.log(`(Review with Yosef first — this is a live invoice draft in LamLinks.)`);
    await pool.close();
    return;
  }

  console.log(`\n=== EXECUTING (all in one transaction) ===`);
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const req = new sql.Request(tx);

    // INSERT kad — capture new id via OUTPUT
    const kadRes = await req.query(`
      INSERT INTO kad_tab (
        cinsta_kad, cinnum_kad, cin_no_kad, cindte_kad, cisdte_kad,
        upname_kad, uptime_kad, idnk31_kad, idnk06_kad,
        pinval_kad, xinval_kad, mslval_kad, nmsval_kad, ppcval_kad,
        cshval_kad, crmval_kad, otcval_kad, ar_val_kad, cinact_kad
      )
      OUTPUT inserted.idnkad_kad AS newId
      VALUES (
        'Not Posted     ', 'S0${cinNo}', '${cinNo}', GETDATE(), GETDATE(),
        'ajoseph   ', GETDATE(), ${idnk31}, 1,
        0, 0, ${invoiceTotal}, 0, 0,
        0, 0, 0, ${invoiceTotal}, ''
      )
    `);
    const newKadId: number = kadRes.recordset[0].newId;
    console.log(`  ✓ kad inserted, idnkad_kad=${newKadId}`);

    // INSERT kae (one per ka9 line) — capture each new id
    const newKaeIds: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      const desc = (award.description || "").replace(/'/g, "''").slice(0, 40);
      const kaeRes = await req.query(`
        INSERT INTO kae_tab (
          idnkad_kae, cilcls_kae, cil_no_kae, cildes_kae,
          cilqty_kae, cil_up_kae, cil_ui_kae, cilext_kae, pinval_kae, xinval_kae
        )
        OUTPUT inserted.idnkae_kae AS newId
        VALUES (
          ${newKadId}, 'Material  ', ${i + 1}, '${desc}',
          ${qty}, ${unitPrice}, 'EA', ${lineExt}, 0, 0
        )
      `);
      const newKaeId: number = kaeRes.recordset[0].newId;
      newKaeIds.push(newKaeId);
      console.log(`  ✓ kae line ${i + 1} inserted, idnkae_kae=${newKaeId}`);
    }

    // UPDATE ka9 — link each ka9 line to its kae
    for (let i = 0; i < lines.length; i++) {
      const upd = await req.query(`
        UPDATE ka9_tab SET idnkae_ka9 = ${newKaeIds[i]}, uptime_ka9 = GETDATE()
        WHERE idnka9_ka9 = ${lines[i].idnka9_ka9} AND (idnkae_ka9 IS NULL OR idnkae_ka9 = 0)
      `);
      if (upd.rowsAffected[0] !== 1) throw new Error(`ka9 update for ${lines[i].idnka9_ka9} affected ${upd.rowsAffected[0]} rows`);
      console.log(`  ✓ ka9 ${lines[i].idnka9_ka9} linked to kae ${newKaeIds[i]}`);
    }

    await tx.commit();
    console.log(`\n✓ Transaction committed.`);
    console.log(`\n→ Tell Yosef: open LamLinks, find invoice cin_no="${cinNo}" (idnkad=${newKadId}).`);
    console.log(`  It should appear in his 'Not Posted' invoice list, ready for him to Post.`);
    console.log(`  Once he clicks Post, the tail script will show the cinsta_kad flip.`);
  } catch (e: any) {
    console.error(`\nERROR: ${e.message}`);
    try { await tx.rollback(); console.log(`  Rolled back.`); } catch {}
    process.exitCode = 1;
  } finally {
    await pool.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
