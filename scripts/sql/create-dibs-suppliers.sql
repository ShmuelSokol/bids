-- DIBS suppliers registry — unifies supplier identity + RFQ email targets
-- across multiple sources:
--   * AX (5,597 vendors total; ~217 have a populated PrimaryEmailAddress)
--   * Auto-research (per nsn_research_findings; supplier_name + supplier_cage,
--     no email yet — Phase 2 will extend research to scrape contact pages)
--   * Manual additions (Abe types in a one-off supplier we want to RFQ)
--
-- Why a new table vs reusing nsn_research_findings.supplier_*?
--   - findings are per-NSN (one supplier appears N times if it ships N items)
--   - we need a SINGLE record per supplier-identity for rate-limiting and
--     for a "view all suppliers" UX
--   - email is the load-bearing field for RFQs and findings doesn't have it
--
-- Keying:
--   * ax_vendor_account is the AX-side internal id (e.g. "000174"); unique
--     within (ax_vendor_account, ax_data_area) since AX is multi-company
--   * cage is the gov-issued CAGE code; unique when present
--   * name is the canonical display name (from AX if known, else research)
--   * Either ax_vendor_account OR cage SHOULD be set. Manual entries can
--     start with neither — just name + email.

CREATE TABLE IF NOT EXISTS dibs_suppliers (
  id                  bigserial PRIMARY KEY,
  ax_vendor_account   text,                 -- "000174" — AX internal id
  ax_data_area        text,                 -- "szyh" etc.
  cage                text,                 -- CAGE code (gov supplier id)
  name                text NOT NULL,
  email               text,                 -- canonical RFQ to-address
  email_alternates    text[],               -- additional emails (semicolon split)
  phone               text,
  source              text NOT NULL,        -- 'ax' | 'research' | 'manual'
  confidence          numeric(3,2),         -- 0.00–1.00, how reliable this email is
  last_verified       timestamptz,          -- when we last confirmed it works
  last_rfq_sent       timestamptz,          -- for rate-limiting (e.g. 1/day)
  rfq_count_total     int NOT NULL DEFAULT 0,
  blocked             boolean NOT NULL DEFAULT false,  -- skip in bulk RFQ generation
  blocked_reason      text,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Uniqueness: AX vendor account is unique within its data area
CREATE UNIQUE INDEX IF NOT EXISTS dibs_suppliers_ax_uniq
  ON dibs_suppliers (ax_vendor_account, ax_data_area)
  WHERE ax_vendor_account IS NOT NULL;

-- CAGE unique when present (CAGE codes are globally unique)
CREATE UNIQUE INDEX IF NOT EXISTS dibs_suppliers_cage_uniq
  ON dibs_suppliers (cage)
  WHERE cage IS NOT NULL;

CREATE INDEX IF NOT EXISTS dibs_suppliers_email_idx ON dibs_suppliers (email);
CREATE INDEX IF NOT EXISTS dibs_suppliers_name_idx ON dibs_suppliers (name);
CREATE INDEX IF NOT EXISTS dibs_suppliers_source_idx ON dibs_suppliers (source);
CREATE INDEX IF NOT EXISTS dibs_suppliers_blocked_idx ON dibs_suppliers (blocked) WHERE blocked = false;

-- Auto-update updated_at on row touch
CREATE OR REPLACE FUNCTION dibs_suppliers_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dibs_suppliers_updated_at_trigger ON dibs_suppliers;
CREATE TRIGGER dibs_suppliers_updated_at_trigger
  BEFORE UPDATE ON dibs_suppliers
  FOR EACH ROW EXECUTE FUNCTION dibs_suppliers_set_updated_at();
