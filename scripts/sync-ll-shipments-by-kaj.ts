/**
 * One-row-per-shipment (kaj) sync. Used by the WAWF ack tracker to
 * resolve idnkaj → contract/NSN/value without the many-to-one row
 * explosion from the CLIN-level sync-shipping.ts.
 *
 * Aggregates ka9 lines per kaj and picks a representative NSN from
 * the first ka9/k81/k71/k08 chain.
 *
 *   npx tsx scripts/sync-ll-shipments-by-kaj.ts [--days 180]
 */
import "./env";
import sql from "mssql/msnodesqlv8";
import { createClient } from "@supabase/supabase-js";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jzgvdfzboknpcrhymjob.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const daysArg = process.argv.indexOf("--days");
  const days = daysArg >= 0 ? parseInt(process.argv[daysArg + 1] ?? "180", 10) : 180;

  const pool = await sql.connect(config);

  // Aggregation query: one row per kaj, with representative info joined from
  // the first ka9 line. Uses OUTER APPLY to get the first k81/k80 for contract
  // and first k08 for NSN, without multiplying rows.
  const q = `
    SELECT
      kaj.idnkaj_kaj AS idnkaj,
      RTRIM(kaj.shpnum_kaj) AS ship_number,
      RTRIM(kaj.shpsta_kaj) AS ship_status,
      COALESCE(kaj.shptme_kaj, kaj.insdte_kaj) AS ship_date,
      RTRIM(kaj.t_mode_kaj) AS transport_mode,
      RTRIM(kaj.trakno_kaj) AS tracking_number,
      RTRIM(kaj.edi_id_kaj) AS edi_id,
      agg.clin_count,
      agg.total_quantity,
      agg.total_value,
      rep.contract_number,
      rep.first_nsn,
      rep.first_description
    FROM kaj_tab kaj
    OUTER APPLY (
      -- xinval_ka9 is always 0 for recent rows (never populated); selval_ka9
      -- holds the real sell value per line.
      SELECT COUNT(*) AS clin_count,
             SUM(COALESCE(ka9.jlnqty_ka9, 0)) AS total_quantity,
             SUM(COALESCE(NULLIF(ka9.xinval_ka9, 0), ka9.selval_ka9, 0)) AS total_value
      FROM ka9_tab ka9 WHERE ka9.idnkaj_ka9 = kaj.idnkaj_kaj
    ) agg
    OUTER APPLY (
      SELECT TOP 1
             RTRIM(k80.piidno_k80) AS contract_number,
             RTRIM(k08.fsc_k08) + '-' + RTRIM(k08.niin_k08) AS first_nsn,
             RTRIM(k08.p_desc_k08) AS first_description
      FROM ka9_tab ka9
      LEFT JOIN k81_tab k81 ON k81.idnk81_k81 = ka9.idnk81_ka9
      LEFT JOIN k80_tab k80 ON k80.idnk80_k80 = k81.idnk80_k81
      LEFT JOIN k71_tab k71 ON k71.idnk71_k71 = k81.idnk71_k81
      LEFT JOIN k08_tab k08 ON k08.idnk08_k08 = k71.idnk08_k71
      WHERE ka9.idnkaj_ka9 = kaj.idnkaj_kaj
      ORDER BY ka9.idnka9_ka9
    ) rep
    WHERE kaj.insdte_kaj >= DATEADD(day, -${days}, GETDATE())
      AND kaj.shpnum_kaj IS NOT NULL
    ORDER BY kaj.idnkaj_kaj DESC
  `;

  console.log(`Pulling kaj-level shipments (last ${days} days)...`);
  const t0 = Date.now();
  const result = await pool.request().query(q);
  const rows = result.recordset;
  console.log(`Found ${rows.length} unique shipments in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await pool.close();

  if (rows.length === 0) return;

  const mapped = rows.map((r: any) => ({
    idnkaj: Number(r.idnkaj),
    ship_number: r.ship_number?.trim() || null,
    ship_status: r.ship_status?.trim() || null,
    ship_date: r.ship_date,
    transport_mode: r.transport_mode?.trim() || null,
    tracking_number: r.tracking_number?.trim() || null,
    edi_id: r.edi_id?.trim() || null,
    contract_number: r.contract_number?.trim() || null,
    clin_count: r.clin_count != null ? Number(r.clin_count) : 0,
    total_quantity: r.total_quantity != null ? Number(r.total_quantity) : 0,
    total_value: r.total_value != null ? Number(r.total_value) : 0,
    first_nsn:
      r.first_nsn && r.first_nsn !== "-" && r.first_nsn.trim() !== "-"
        ? r.first_nsn.trim().replace(/\s+/g, "")
        : null,
    first_description: r.first_description?.trim() || null,
  }));

  let written = 0;
  for (let i = 0; i < mapped.length; i += 500) {
    const batch = mapped.slice(i, i + 500);
    const { error, count } = await sb
      .from("ll_shipments_by_kaj")
      .upsert(batch, { onConflict: "idnkaj", count: "exact" });
    if (error) {
      console.error(`batch ${i}: ${error.message}`);
      break;
    }
    written += count ?? batch.length;
  }

  console.log(`Upserted ${written} kaj-level shipments`);
  await sb.from("sync_log").insert({
    action: "ll_shipments_by_kaj_sync",
    details: { rows_pulled: rows.length, rows_written: written, days },
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
