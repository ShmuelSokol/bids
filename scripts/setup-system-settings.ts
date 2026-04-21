// Create system_settings table + seed the lamlinks_writeback_enabled row.
import "./env";

async function main() {
  const mgmtUrl = "https://api.supabase.com/v1/projects/jzgvdfzboknpcrhymjob/database/query";
  const mgmtToken = process.env.SUPABASE_MGMT_TOKEN;
  if (!mgmtToken) throw new Error("SUPABASE_MGMT_TOKEN missing from .env");

  const sql = `
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      updated_by TEXT
    );

    INSERT INTO system_settings (key, value, description)
    VALUES (
      'lamlinks_writeback_enabled',
      'false',
      'When true, DIBS Quoted→Submit action inserts bids into LamLinks k33/k34/k35 via a Windows worker. When false, only marks bid_decisions.status locally.'
    )
    ON CONFLICT (key) DO NOTHING;

    CREATE TABLE IF NOT EXISTS lamlinks_write_queue (
      id SERIAL PRIMARY KEY,
      solicitation_number TEXT NOT NULL,
      nsn TEXT NOT NULL,
      bid_price NUMERIC NOT NULL,
      bid_qty INTEGER NOT NULL,
      delivery_days INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      picked_up_at TIMESTAMPTZ,
      processed_at TIMESTAMPTZ,
      envelope_idnk33 INTEGER,
      line_idnk34 INTEGER,
      price_idnk35 INTEGER,
      error_message TEXT,
      created_by TEXT,
      UNIQUE(solicitation_number, nsn, status)
    );
    CREATE INDEX IF NOT EXISTS idx_lamlinks_queue_status ON lamlinks_write_queue(status, created_at);
  `;

  const resp = await fetch(mgmtUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${mgmtToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const body = await resp.text();
  console.log(`status=${resp.status}  ${body}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
