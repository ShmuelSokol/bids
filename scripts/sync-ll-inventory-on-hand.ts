/**
 * Aggregate LL k93_tab (inventory/inspection records) into ll_inventory_on_hand
 * — one row per NSN with total on-hand + reserved qty.
 *
 * k93 has 260K+ rows (every receipt lot ever). We group by NSN and take
 * the sum of snq_21_k93 (quantity) and rsvqty_k93 (reserved). The
 * result is ~10-15K NSNs with stock.
 *
 *   npx tsx scripts/sync-ll-inventory-on-hand.ts
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
  const pool = await sql.connect(config);

  const q = `
    SELECT
      RTRIM(k08.fsc_k08) AS fsc,
      RTRIM(k08.niin_k08) AS niin,
      RTRIM(k08.p_desc_k08) AS description,
      COUNT(*) AS lots,
      SUM(CAST(k93.snq_21_k93 AS bigint)) AS qty_on_hand,
      SUM(CAST(ISNULL(k93.rsvqty_k93, 0) AS bigint)) AS qty_reserved,
      SUM(CAST(ISNULL(k93.fstval_k93, 0) AS numeric(18,2))) AS stock_value
    FROM k93_tab k93
    JOIN k71_tab k71 ON k71.idnk71_k71 = k93.idnk71_k93
    JOIN k08_tab k08 ON k08.idnk08_k08 = k71.idnk08_k71
    WHERE k93.snq_21_k93 > 0
      AND k08.fsc_k08 IS NOT NULL
      AND k08.niin_k08 IS NOT NULL
    GROUP BY RTRIM(k08.fsc_k08), RTRIM(k08.niin_k08), RTRIM(k08.p_desc_k08)
    HAVING SUM(CAST(k93.snq_21_k93 AS bigint)) > 0
  `;

  console.log("Aggregating k93_tab → on-hand per NSN...");
  const t0 = Date.now();
  const result = await pool.request().query(q);
  const rows = result.recordset;
  console.log(`Found ${rows.length} NSNs with stock in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await pool.close();

  if (rows.length === 0) return;

  const mapped = rows
    .map((r: any) => {
      const qty = Number(r.qty_on_hand) || 0;
      const reserved = Number(r.qty_reserved) || 0;
      const fsc = String(r.fsc ?? "").trim();
      const niin = String(r.niin ?? "").trim();
      return {
        fsc,
        niin,
        nsn: `${fsc}-${niin}`,
        description: r.description ? String(r.description).trim() : null,
        lots: Number(r.lots) || 0,
        qty_on_hand: qty,
        qty_reserved: reserved,
        qty_available: Math.max(0, qty - reserved),
        stock_value: Number(r.stock_value) || 0,
      };
    })
    // Drop NSNs missing fsc or niin (the k93 query can surface blank-string
    // keys from corrupt k08 rows; they'd all collide on the same upsert key).
    .filter((r) => r.fsc && r.niin);

  // Dedupe by (fsc, niin) — same NSN can appear with different p_desc_k08
  // variants. Keep the highest-qty row.
  const deduped = new Map<string, typeof mapped[number]>();
  for (const m of mapped) {
    const key = `${m.fsc}|${m.niin}`;
    const existing = deduped.get(key);
    if (!existing || m.qty_on_hand > existing.qty_on_hand) {
      deduped.set(key, m);
    } else if (m.qty_on_hand === existing.qty_on_hand && !existing.description && m.description) {
      // Same qty, prefer the row that actually has a description
      deduped.set(key, m);
    }
  }
  const dedupedRows = [...deduped.values()];
  if (dedupedRows.length < mapped.length) {
    console.log(`  deduped ${mapped.length - dedupedRows.length} duplicate (fsc, niin) keys`);
  }

  // Upsert in chunks. Use the unique (fsc, niin) as the conflict key.
  let written = 0;
  for (let i = 0; i < dedupedRows.length; i += 500) {
    const batch = dedupedRows.slice(i, i + 500);
    const { error, count } = await sb
      .from("ll_inventory_on_hand")
      .upsert(batch, { onConflict: "fsc,niin", count: "exact" });
    if (error) {
      console.error(`batch ${i}: ${error.message}`);
      break;
    }
    written += count ?? batch.length;
  }

  console.log(`Upserted ${written} rows to ll_inventory_on_hand`);

  const totalQty = dedupedRows.reduce((s, m) => s + m.qty_on_hand, 0);
  const totalValue = dedupedRows.reduce((s, m) => s + m.stock_value, 0);
  console.log(`  total on-hand: ${totalQty.toLocaleString()} units, $${totalValue.toLocaleString()} book value`);
  const topTen = [...dedupedRows].sort((a, b) => b.qty_on_hand - a.qty_on_hand).slice(0, 10);
  console.log(`  top 10 by qty:`);
  for (const m of topTen) {
    console.log(`    ${m.nsn.padEnd(20)} ${String(m.qty_on_hand).padStart(10)} units  ${m.description?.slice(0, 40) ?? ""}`);
  }

  await sb.from("sync_log").insert({
    action: "ll_inventory_sync",
    details: {
      nsns_with_stock: dedupedRows.length,
      total_units: totalQty,
      total_value: totalValue,
    },
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
