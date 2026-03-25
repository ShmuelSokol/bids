/**
 * Set up Supabase schema for DIBS and seed with discovery data.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

const SUPABASE_URL = "https://jzgvdfzboknpcrhymjob.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6Z3ZkZnpib2tucGNyaHltam9iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ2NjU2NiwiZXhwIjoyMDkwMDQyNTY2fQ.u1GycK2kRPFjYrj75VteWyFEfuUb7bbO91uwNp6VMzo";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const DATA_DIR = join(__dirname, "..", "data", "llk-discovery");

async function runSQL(sql: string) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  return resp;
}

async function main() {
  console.log("Setting up Supabase schema...\n");

  // Use the SQL endpoint via management API
  const mgmtUrl = "https://api.supabase.com/v1/projects/jzgvdfzboknpcrhymjob/database/query";
  const mgmtToken = "sbp_a72fd1c5ebac1a37e5c7a29d5967290e6ee377f3";

  const sql = `
    -- FSC Heatmap
    CREATE TABLE IF NOT EXISTS fsc_heatmap (
      fsc_code TEXT PRIMARY KEY,
      total_bids INTEGER DEFAULT 0,
      most_recent_bid TIMESTAMPTZ,
      oldest_bid TIMESTAMPTZ,
      bids_last_6_months INTEGER DEFAULT 0,
      bids_last_month INTEGER DEFAULT 0,
      bucket TEXT, -- hot, warm, cold
      dla_spend_6mo NUMERIC,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Bid History (summary by NSN, not all 492K rows)
    CREATE TABLE IF NOT EXISTS bid_summary (
      id SERIAL PRIMARY KEY,
      fsc TEXT,
      niin TEXT,
      description TEXT,
      total_bids INTEGER,
      avg_unit_price NUMERIC,
      min_unit_price NUMERIC,
      max_unit_price NUMERIC,
      avg_lead_time INTEGER,
      last_bid_date TIMESTAMPTZ,
      manufacturer_cage TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Awards
    CREATE TABLE IF NOT EXISTS awards (
      id SERIAL PRIMARY KEY,
      contract_number TEXT,
      clin TEXT,
      fsc TEXT,
      niin TEXT,
      part_number TEXT,
      description TEXT,
      cage TEXT,
      unit_price NUMERIC,
      quantity INTEGER,
      extended_value NUMERIC,
      order_number TEXT,
      tcn TEXT,
      ship_status TEXT,
      fob TEXT,
      award_date TIMESTAMPTZ,
      required_delivery TIMESTAMPTZ,
      piid TEXT,
      fast_pay TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- USASpending DLA Awards
    CREATE TABLE IF NOT EXISTS usaspending_awards (
      id SERIAL PRIMARY KEY,
      award_id TEXT,
      recipient_name TEXT,
      award_amount NUMERIC,
      description TEXT,
      start_date DATE,
      end_date DATE,
      awarding_sub_agency TEXT,
      generated_internal_id TEXT UNIQUE,
      psc_code TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- FSC Expansion Opportunities
    CREATE TABLE IF NOT EXISTS fsc_expansion (
      fsc_code TEXT PRIMARY KEY,
      solicitations_received INTEGER DEFAULT 0,
      bids_placed INTEGER DEFAULT 0,
      bid_rate_pct NUMERIC,
      sols_last_6mo INTEGER DEFAULT 0,
      bids_last_6mo INTEGER DEFAULT 0,
      dla_spend_6mo NUMERIC,
      status TEXT, -- unbid, low_rate, active
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Item Master (key fields from k08_tab)
    CREATE TABLE IF NOT EXISTS item_master (
      id SERIAL PRIMARY KEY,
      fsc TEXT,
      niin TEXT,
      part_number TEXT,
      manufacturer_cage TEXT,
      description TEXT,
      unit_price NUMERIC,
      unit_of_measure TEXT,
      weight NUMERIC,
      nsn TEXT GENERATED ALWAYS AS (fsc || '-' || niin) STORED,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- NSN to UPC mappings (for Master DB enrichment)
    CREATE TABLE IF NOT EXISTS nsn_upc_map (
      id SERIAL PRIMARY KEY,
      nsn TEXT,
      upc TEXT,
      source TEXT, -- govcagecodes, d365, manual
      confidence NUMERIC DEFAULT 1.0,
      masterdb_item_id INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_fsc_heatmap_bucket ON fsc_heatmap(bucket);
    CREATE INDEX IF NOT EXISTS idx_bid_summary_fsc ON bid_summary(fsc);
    CREATE INDEX IF NOT EXISTS idx_awards_fsc ON awards(fsc);
    CREATE INDEX IF NOT EXISTS idx_item_master_fsc ON item_master(fsc);
    CREATE INDEX IF NOT EXISTS idx_item_master_nsn ON item_master(nsn);
    CREATE INDEX IF NOT EXISTS idx_usaspending_psc ON usaspending_awards(psc_code);
    CREATE INDEX IF NOT EXISTS idx_fsc_expansion_status ON fsc_expansion(status);
  `;

  console.log("Creating tables...");
  const resp = await fetch(mgmtUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${mgmtToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error("Schema creation failed:", resp.status, text);
    return;
  }
  console.log("Tables created!\n");

  // Seed FSC heatmap
  console.log("Seeding fsc_heatmap...");
  const heatmap = JSON.parse(readFileSync(join(DATA_DIR, "fsc-heatmap.json"), "utf-8"));
  const heatmapRows = heatmap.map((r: any) => ({
    fsc_code: r.fsc_code.trim(),
    total_bids: r.total_bids,
    most_recent_bid: r.most_recent_bid,
    oldest_bid: r.oldest_bid,
    bids_last_6_months: r.bids_last_6_months,
    bids_last_month: r.bids_last_month,
    bucket: r.bids_last_month > 0 ? "hot" : r.bids_last_6_months > 0 ? "warm" : "cold",
  }));

  const { error: heatErr } = await supabase.from("fsc_heatmap").upsert(heatmapRows, { onConflict: "fsc_code" });
  if (heatErr) console.error("  fsc_heatmap error:", heatErr.message);
  else console.log(`  ${heatmapRows.length} FSC codes loaded`);

  // Seed FSC expansion
  console.log("Seeding fsc_expansion...");
  const expansion = JSON.parse(readFileSync(join(DATA_DIR, "fsc-expansion.json"), "utf-8"));
  const expansionRows = expansion.map((r: any) => ({
    fsc_code: r.fsc_code.trim(),
    solicitations_received: r.solicitations_received,
    bids_placed: r.bids_placed,
    bid_rate_pct: r.bid_rate_pct,
    sols_last_6mo: r.sols_last_6mo,
    bids_last_6mo: r.bids_last_6mo,
    status: r.bids_last_6mo === 0 && r.sols_last_6mo > 0 ? "unbid" :
            r.bid_rate_pct !== null && r.bid_rate_pct < 10 ? "low_rate" : "active",
  }));

  const { error: expErr } = await supabase.from("fsc_expansion").upsert(expansionRows, { onConflict: "fsc_code" });
  if (expErr) console.error("  fsc_expansion error:", expErr.message);
  else console.log(`  ${expansionRows.length} FSC expansion rows loaded`);

  // Seed recent awards (5K)
  console.log("Seeding awards...");
  const awards = JSON.parse(readFileSync(join(DATA_DIR, "awards-recent.json"), "utf-8"));
  const awardRows = awards.map((r: any) => ({
    contract_number: r.cntrct_k79?.trim(),
    clin: r.clinno_k81?.trim(),
    fsc: r.fsc_k08?.trim(),
    niin: r.niin_k08?.trim(),
    part_number: r.prtnum_k71?.trim(),
    description: r.p_desc_k71?.trim(),
    cage: r.cage_k13?.trim(),
    unit_price: r.cln_up_k81,
    quantity: r.clnqty_k81,
    extended_value: r.clnext_k81,
    order_number: r.ordrno_k81?.trim(),
    tcn: r.tcn_k81?.trim(),
    ship_status: r.shpsta_k81?.trim(),
    fob: r.fob_od_k81?.trim(),
    award_date: r.addtme_k81,
    required_delivery: r.reqdly_k81,
    piid: r.piidno_k80?.trim(),
    fast_pay: r.faspay_k80?.trim(),
  }));

  // Insert in batches of 500
  for (let i = 0; i < awardRows.length; i += 500) {
    const batch = awardRows.slice(i, i + 500);
    const { error } = await supabase.from("awards").insert(batch);
    if (error) {
      console.error(`  awards batch ${i} error:`, error.message);
      break;
    }
  }
  console.log(`  ${awardRows.length} awards loaded`);

  // Seed USASpending
  console.log("Seeding usaspending_awards...");
  try {
    const usaAwards = JSON.parse(
      readFileSync(join(__dirname, "..", "data", "usaspending", "dla-awards-6mo.json"), "utf-8")
    );
    const usaRows = usaAwards.map((r: any) => ({
      award_id: r["Award ID"],
      recipient_name: r["Recipient Name"],
      award_amount: r["Award Amount"],
      description: r["Description"],
      start_date: r["Start Date"],
      end_date: r["End Date"],
      awarding_sub_agency: r["Awarding Sub Agency"],
      generated_internal_id: r["generated_internal_id"],
    }));

    for (let i = 0; i < usaRows.length; i += 500) {
      const batch = usaRows.slice(i, i + 500);
      const { error } = await supabase.from("usaspending_awards").upsert(batch, { onConflict: "generated_internal_id" });
      if (error) {
        console.error(`  usaspending batch ${i} error:`, error.message);
        break;
      }
    }
    console.log(`  ${usaRows.length} USASpending awards loaded`);
  } catch {
    console.log("  USASpending data not found, skipping");
  }

  console.log("\nDone! Supabase is seeded.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
