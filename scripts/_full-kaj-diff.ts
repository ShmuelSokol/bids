import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  const our = (await pool.request().query(`SELECT * FROM kaj_tab WHERE idnkaj_kaj = 353349`)).recordset[0];
  const abe = (await pool.request().query(`SELECT * FROM kaj_tab WHERE idnkaj_kaj = 353327`)).recordset[0];
  if (!our || !abe) { console.log("missing"); await pool.close(); return; }
  console.log(`=== ALL FIELDS, ours=353349 vs abe=353327 ===`);
  const allKeys = new Set([...Object.keys(our), ...Object.keys(abe)]);
  for (const k of [...allKeys].sort()) {
    const a = our[k]; const b = abe[k];
    const aStr = a == null ? "<null>" : a instanceof Date ? a.toISOString() : `"${String(a)}"`;
    const bStr = b == null ? "<null>" : b instanceof Date ? b.toISOString() : `"${String(b)}"`;
    if (aStr === bStr) continue;
    // Skip uninteresting differences
    if (k === "idnkaj_kaj" || k === "uptime_kaj" || k === "idnk80_kaj" || k === "shptme_kaj" || k === "insdte_kaj") continue;
    console.log(`  ${k}: ours=${aStr.slice(0,80)} abe=${bStr.slice(0,80)}`);
  }
  // Same for k80
  const ours_k80 = (await pool.request().query(`SELECT * FROM k80_tab WHERE idnk80_k80 = ${our.idnk80_kaj}`)).recordset[0];
  const abes_k80 = (await pool.request().query(`SELECT * FROM k80_tab WHERE idnk80_k80 = ${abe.idnk80_kaj}`)).recordset[0];
  if (ours_k80 && abes_k80) {
    console.log(`\n=== k80 diff (ours=${our.idnk80_kaj} vs abe=${abe.idnk80_kaj}) ===`);
    const k80Keys = new Set([...Object.keys(ours_k80), ...Object.keys(abes_k80)]);
    for (const k of [...k80Keys].sort()) {
      const a = ours_k80[k]; const b = abes_k80[k];
      const aStr = a == null ? "<null>" : a instanceof Date ? a.toISOString() : `"${String(a)}"`;
      const bStr = b == null ? "<null>" : b instanceof Date ? b.toISOString() : `"${String(b)}"`;
      if (aStr === bStr) continue;
      if (["idnk80_k80","addtme_k80","idnk79_k80","reldte_k80","relext_k80","rlsdte_k80"].includes(k)) continue;
      console.log(`  ${k}: ours=${aStr.slice(0,80)} abe=${bStr.slice(0,80)}`);
    }
  }
  await pool.close();
})();
