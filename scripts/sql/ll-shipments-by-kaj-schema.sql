-- One row per kaj (shipment header). Used by the WAWF ack tracker to
-- join EDI transmissions (keyed by idnkaj) to the shipment's contract
-- and value info without the many-to-one inflation from kaj→ka9→k81.
--
-- Populated by scripts/sync-ll-shipments-by-kaj.ts.

CREATE TABLE IF NOT EXISTS ll_shipments_by_kaj (
  idnkaj INTEGER PRIMARY KEY,
  ship_number TEXT,
  ship_status TEXT,
  ship_date TIMESTAMPTZ,
  transport_mode TEXT,
  tracking_number TEXT,
  edi_id TEXT,
  contract_number TEXT,               -- from k80.piidno_k80 via first k81 under this shipment
  clin_count INTEGER,                 -- number of ka9 lines under this kaj
  total_quantity NUMERIC(18,0),       -- sum of ka9 qty
  total_value NUMERIC(14,2),          -- sum of ka9 value
  first_nsn TEXT,                     -- representative NSN (from first ka9/k81/k71/k08)
  first_description TEXT,             -- representative description
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ll_shipments_by_kaj_contract_idx ON ll_shipments_by_kaj(contract_number);
CREATE INDEX IF NOT EXISTS ll_shipments_by_kaj_date_idx ON ll_shipments_by_kaj(ship_date DESC);
