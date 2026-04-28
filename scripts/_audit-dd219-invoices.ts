import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  // Last 30 days of DD219 invoices (idnk31=203)
  const r = await pool.request().query(`
    SELECT TOP 30
      kad.idnkad_kad, kad.cin_no_kad, kad.cinnum_kad, kad.cinsta_kad,
      kad.cindte_kad, kad.upname_kad, kad.mslval_kad, kad.idnk31_kad,
      (SELECT COUNT(*) FROM kae_tab WHERE idnkad_kae = kad.idnkad_kad) AS line_count
    FROM kad_tab kad
    WHERE kad.idnk31_kad = 203
      AND kad.uptime_kad >= DATEADD(DAY, -30, GETDATE())
    ORDER BY kad.uptime_kad DESC
  `);
  console.log(`Last 30 days DD219 invoices: ${r.recordset.length}`);
  for (const row of r.recordset) {
    const cin_no = String(row.cin_no_kad || "").trim();
    const cinnum = String(row.cinnum_kad || "").trim();
    console.log(`  kad=${row.idnkad_kad}  cin_no="${cin_no}"  cinnum="${cinnum}"  $${row.mslval_kad}  lines=${row.line_count}  date=${String(row.cindte_kad).slice(0,10)}  by=${String(row.upname_kad).trim()}`);
  }

  // Multi-line — pick the highest line count one and show its kae rows
  const multi = r.recordset.find((x: any) => x.line_count > 1);
  if (multi) {
    console.log(`\n=== Multi-line invoice ${multi.idnkad_kad} (${multi.line_count} lines) ===`);
    const kae = await pool.request().query(`
      SELECT idnkae_kae, cilcls_kae, cil_no_kae, cildes_kae, cilqty_kae, cil_up_kae, cil_ui_kae, cilext_kae
      FROM kae_tab WHERE idnkad_kae = ${multi.idnkad_kad}
      ORDER BY cil_no_kae
    `);
    for (const k of kae.recordset) {
      console.log(`  line ${k.cil_no_kae}: cls=${String(k.cilcls_kae).trim()} qty=${k.cilqty_kae}${String(k.cil_ui_kae).trim()} @ $${k.cil_up_kae} = $${k.cilext_kae} - ${String(k.cildes_kae).trim()}`);
    }
  } else {
    console.log("\n(All last-30-day DD219 invoices are single-line.)");
  }

  // Pattern check on cin_no vs cinnum
  console.log(`\n=== cin_no/cinnum patterns ===`);
  const patterns = new Map<string, number>();
  for (const row of r.recordset) {
    const cin_no = String(row.cin_no_kad || "").trim();
    const cinnum = String(row.cinnum_kad || "").trim();
    // Detect: cinnum = cin_no? cinnum starts S0? cinnum is AX-style?
    const numericCinNo = /^\d+$/.test(cin_no);
    const cinnumStartsS0 = cinnum.startsWith("S0");
    const cinnumDigitsOnly = /^\d+$/.test(cinnum);
    const cinnumMatchesCinNo = cinnum === cin_no;
    const tag = `numericCinNo=${numericCinNo} cinnumS0=${cinnumStartsS0} cinnumDigits=${cinnumDigitsOnly} match=${cinnumMatchesCinNo}`;
    patterns.set(tag, (patterns.get(tag) || 0) + 1);
  }
  for (const [t, n] of patterns.entries()) console.log(`  ${n}× ${t}`);

  await pool.close();
})();
