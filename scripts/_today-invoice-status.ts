import "./env";
import sql from "mssql/msnodesqlv8";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  // Pull all today's queue rows
  const { data: queue } = await sb.from("lamlinks_invoice_queue")
    .select("ax_invoice_number, ax_total_amount, ax_customer_order_reference, state, ll_idnkad")
    .eq("ax_invoice_date", new Date().toISOString().slice(0, 10))
    .order("ax_invoice_number");
  console.log(`\nDIBS queue rows for today: ${queue?.length ?? 0}`);
  for (const r of queue || []) console.log(`  ${r.ax_invoice_number}  $${r.ax_total_amount}  state=${r.state}${r.ll_idnkad ? ` (kad=${r.ll_idnkad})` : ""}  ref=${r.ax_customer_order_reference}`);

  // Also check how many today's DD219 are already POSTED in LL (kad)
  const pool = await sql.connect({ connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;" });
  const ll = await pool.request().query(`
    SELECT idnkad_kad, cinnum_kad, cin_no_kad, mslval_kad, cisdte_kad
    FROM kad_tab
    WHERE idnk31_kad = 203
      AND CAST(cisdte_kad AS DATE) = CAST(GETDATE() AS DATE)
      AND LTRIM(RTRIM(cinsta_kad)) = 'Posted'
    ORDER BY uptime_kad DESC
  `);
  console.log(`\nLL kad already posted today: ${ll.recordset.length}`);
  for (const k of ll.recordset) console.log(`  cinnum=${String(k.cinnum_kad).trim()} cin_no=${String(k.cin_no_kad).trim()} $${k.mslval_kad}  idnkad=${k.idnkad_kad}`);
  await pool.close();
})();
