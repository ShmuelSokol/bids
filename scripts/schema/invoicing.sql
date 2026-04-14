-- Invoicing schema for DIBS (2026-04-14)
--
-- Backs the 3 CRITICAL invoicing findings from the audit:
--   - gov_invoice_number collision (we can now detect duplicates on insert)
--   - generated EDI content ephemeral (we persist it here)
--   - remittance matching hardcoded mock (we can now look up real invoices)

-- Every invoice we generate an EDI 810 for. One row per gov-invoice-number.
CREATE TABLE IF NOT EXISTS invoices (
  id             BIGSERIAL PRIMARY KEY,
  gov_invoice_number TEXT NOT NULL UNIQUE,          -- 7-char format
  contract_number    TEXT NOT NULL,
  contract_date      DATE,
  invoice_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount       NUMERIC(12,2),
  ship_to_name       TEXT,
  ship_to_address    TEXT,
  ship_to_city       TEXT,
  ship_to_state      TEXT,
  ship_to_zip        TEXT,
  ship_to_dodaac     TEXT,
  line_count         INTEGER DEFAULT 0,
  edi_content        TEXT,                          -- full X12 810 transaction
  status             TEXT DEFAULT 'generated',      -- generated, submitted, paid, failed
  ax_invoice_number  TEXT,                          -- populated when we wire AX
  wawf_ack_status    TEXT,                          -- 997 acknowledgement if we ever parse
  generated_by       TEXT,
  submitted_at       TIMESTAMPTZ,
  paid_at            TIMESTAMPTZ,
  paid_amount        NUMERIC(12,2),
  wire_reference     TEXT,                          -- from remittance parse
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invoices_contract_idx ON invoices(contract_number);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices(status);
CREATE INDEX IF NOT EXISTS invoices_invoice_date_idx ON invoices(invoice_date DESC);

-- Line items for each invoice (from the awards that were billed).
CREATE TABLE IF NOT EXISTS invoice_lines (
  id             BIGSERIAL PRIMARY KEY,
  invoice_id     BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  line_number    INTEGER NOT NULL,
  nsn            TEXT,
  description    TEXT,
  quantity       INTEGER,
  unit_price     NUMERIC(10,4),
  extended_amount NUMERIC(12,2),
  uom            TEXT DEFAULT 'EA',
  UNIQUE(invoice_id, line_number)
);

-- DLA payment wires. One row per inbound remittance batch.
CREATE TABLE IF NOT EXISTS remittance_records (
  id              BIGSERIAL PRIMARY KEY,
  wire_date       DATE NOT NULL,
  wire_reference  TEXT NOT NULL,
  total_amount    NUMERIC(12,2),
  total_credits   NUMERIC(12,2),
  total_deductions NUMERIC(12,2),
  net_amount      NUMERIC(12,2),
  line_count      INTEGER,
  matched_count   INTEGER,
  unmatched_count INTEGER,
  raw_text        TEXT,                             -- the pasted remittance as-is
  parsed_lines    JSONB,                            -- array of line objects
  unmatched_lines JSONB,                            -- lines we couldn't match
  imported_by     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wire_date, wire_reference)
);

CREATE INDEX IF NOT EXISTS remittance_wire_date_idx ON remittance_records(wire_date DESC);
