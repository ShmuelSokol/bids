import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  const r = await pool.request().query(`
    SELECT
      kad.cinnum_kad AS cinnum,
      kad.cinsta_kad AS cinsta,
      kaj.idnkaj_kaj AS kaj,
      kaj.shpsta_kaj AS kaj_shpsta,
      ka9.jlnsta_ka9 AS ka9_jlnsta,
      ka9.idnkae_ka9 AS ka9_idnkae,
      k80.rlssta_k80 AS k80_rlssta,
      k81.idnk81_k81 AS k81,
      k81.shpsta_k81 AS k81_shpsta,
      k81.stadte_k81 AS k81_stadte
    FROM kad_tab kad
    LEFT JOIN kae_tab kae ON kae.idnkad_kae = kad.idnkad_kad
    LEFT JOIN ka9_tab ka9 ON ka9.idnkae_ka9 = kae.idnkae_kae
    LEFT JOIN kaj_tab kaj ON kaj.idnkaj_kaj = ka9.idnkaj_ka9
    LEFT JOIN k80_tab k80 ON k80.idnk80_k80 = kaj.idnk80_kaj
    LEFT JOIN k81_tab k81 ON k81.idnk80_k81 = k80.idnk80_k80
    WHERE kad.cinnum_kad = '0066186'
  `);
  console.log("Final state of CIN0066186:");
  for (const row of r.recordset) {
    for (const [k, v] of Object.entries(row)) {
      console.log(`  ${k}: ${v instanceof Date ? v.toISOString() : String(v).trim()}`);
    }
    console.log("---");
  }
  await pool.close();
})();
