-- Per-NSN on-hand inventory aggregated from LL k93_tab (inspection/
-- inventory records) joined to k08_tab (item master). Each k93 row is
-- one receipt lot — we roll them up so the UI can answer "do we have
-- this in stock right now?"

CREATE TABLE IF NOT EXISTS ll_inventory_on_hand (
  id BIGSERIAL PRIMARY KEY,
  fsc TEXT NOT NULL,
  niin TEXT NOT NULL,
  nsn TEXT NOT NULL,
  description TEXT,
  lots INTEGER NOT NULL,                -- number of distinct k93 records for this NSN
  qty_on_hand NUMERIC(18,0) NOT NULL,   -- sum(snq_21_k93) across lots
  qty_reserved NUMERIC(18,0),           -- sum(rsvqty_k93) — held for existing orders
  qty_available NUMERIC(18,0),          -- qty_on_hand - qty_reserved
  stock_value NUMERIC(14,2),            -- sum(fstval_k93) — book value; often 0
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fsc, niin)
);
CREATE INDEX IF NOT EXISTS ll_inventory_on_hand_nsn_idx ON ll_inventory_on_hand(nsn);
CREATE INDEX IF NOT EXISTS ll_inventory_on_hand_qty_idx ON ll_inventory_on_hand(qty_on_hand DESC);
