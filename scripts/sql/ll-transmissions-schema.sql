-- LamLinks EDI transmissions + POD records — mirror of kbr_tab + k89_tab
-- Source of truth lives in llk_db1 on NYEVRVSQL001. We sync read-only
-- snapshots to Supabase so the Next.js UI on Railway can display them.
--
-- Run this once via Supabase dashboard → SQL Editor, OR via:
--   npx tsx scripts/setup-ll-transmissions-tables.ts
--   (requires SUPABASE_MGMT_TOKEN in env)

-- ============================================================================
-- EDI transmissions (kbr_tab): WAWF 810 / 856 / 857 + SAMMS + DPMS history
-- Each shipment (kaj row) or invoice (kad row) can have multiple kbr rows,
-- one per scenario. xtcsta_kbr tells us sent/acked/problem/not-sent.
-- ============================================================================
CREATE TABLE IF NOT EXISTS ll_edi_transmissions (
  id BIGSERIAL PRIMARY KEY,
  idnkbr INTEGER NOT NULL UNIQUE,          -- kbr_tab.idnkbr_kbr
  parent_table TEXT NOT NULL,              -- kbr_tab.itttbl_kbr — 'kaj' (shipment), 'kad' (c-invoice), 'k80' (sales order), etc.
  parent_id INTEGER NOT NULL,              -- kbr_tab.idnitt_kbr — the row id in parent_table
  idnkap INTEGER,                          -- kbr_tab.idnkap_kbr — join into kap_tab (category/PO action)
  scenario TEXT,                           -- kbr_tab.xtcscn_kbr — free-text scenario code
  status TEXT NOT NULL,                    -- kbr_tab.xtcsta_kbr — 'WAWF 810 sent' / 'WAWF 856 acknowledged' / etc
  transmitted_at TIMESTAMPTZ NOT NULL,     -- kbr_tab.xtctme_kbr
  added_by TEXT,                           -- kbr_tab.addnme_kbr (trimmed)
  added_at TIMESTAMPTZ,                    -- kbr_tab.addtme_kbr
  -- Derived convenience columns for UI filtering
  edi_type TEXT,                           -- '810' | '856' | '857' | 'DPMS' | 'OTHER' (derived from status)
  lifecycle TEXT,                          -- 'sent' | 'acknowledged' | 'problem' | 'not_sent' | 'other'
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ll_edi_parent_idx ON ll_edi_transmissions(parent_table, parent_id);
CREATE INDEX IF NOT EXISTS ll_edi_status_idx ON ll_edi_transmissions(lifecycle, transmitted_at DESC);
CREATE INDEX IF NOT EXISTS ll_edi_transmitted_idx ON ll_edi_transmissions(transmitted_at DESC);

-- ============================================================================
-- POD records (k89_tab): received POs / customer orders + DLA POD acks
-- ============================================================================
CREATE TABLE IF NOT EXISTS ll_pod_records (
  id BIGSERIAL PRIMARY KEY,
  idnk89 INTEGER NOT NULL UNIQUE,          -- k89_tab.idnk89_k89
  po_number TEXT,                          -- por_no_k89
  po_date TIMESTAMPTZ,                     -- po_dte_k89
  po_value NUMERIC(14,2),                  -- po_val_k89
  pod_status TEXT,                         -- podsta_k89: 'Not Sent' / 'Sent' / 'Acknowledged' / 'Pending Review' / 'Approved' / 'Hold'
  pod_date TIMESTAMPTZ,                    -- poddte_k89
  receipt_status TEXT,                     -- rcvsta_k89: 'Pending' / 'Back Order' / 'Completed' / 'Cancelled'
  receipt_date TIMESTAMPTZ,                -- rcedte_k89
  contract_number TEXT,                    -- cnt_no_k89
  contract_price TEXT,                     -- cntpri_k89
  fob_type TEXT,                           -- fobtyp_k89
  fob_zip TEXT,                            -- fobzip_k89
  shipping_info TEXT,                      -- shipin_k89
  updated_at_ll TIMESTAMPTZ,               -- uptime_k89 (LL's update time)
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ll_pod_contract_idx ON ll_pod_records(contract_number);
CREATE INDEX IF NOT EXISTS ll_pod_status_idx ON ll_pod_records(pod_status, pod_date DESC);
CREATE INDEX IF NOT EXISTS ll_pod_po_idx ON ll_pod_records(po_number);

-- ============================================================================
-- View — unified shipment + WAWF health for the UI. LEFT JOINs so every
-- shipment appears even if no EDI transmissions have been logged yet.
-- (Recreated idempotently — safe to re-run during schema iteration.)
-- ============================================================================
DROP VIEW IF EXISTS ll_shipments_with_edi;
CREATE VIEW ll_shipments_with_edi AS
SELECT
  s.*,
  COALESCE(wawf_856.status, 'Not Sent')                          AS wawf_856_status,
  wawf_856.transmitted_at                                        AS wawf_856_at,
  COALESCE(wawf_810.status, 'Not Sent')                          AS wawf_810_status,
  wawf_810.transmitted_at                                        AS wawf_810_at,
  CASE
    WHEN wawf_810.lifecycle = 'acknowledged'    THEN 'complete'
    WHEN wawf_810.lifecycle = 'problem'         THEN 'problem'
    WHEN wawf_810.lifecycle = 'sent'            THEN 'pending_ack'
    WHEN wawf_856.lifecycle = 'acknowledged'    THEN 'asn_ack_only'
    WHEN wawf_856.lifecycle IS NOT NULL         THEN 'in_flight'
    ELSE 'not_started'
  END                                                            AS edi_health
FROM ll_shipments s
LEFT JOIN LATERAL (
  SELECT t.status, t.transmitted_at, t.lifecycle
  FROM ll_edi_transmissions t
  WHERE t.parent_table = 'kaj'
    AND t.parent_id = s.id        -- ll_shipments.id holds idnkaj_kaj per sync-shipping.ts
    AND t.edi_type = '810'
  ORDER BY t.transmitted_at DESC
  LIMIT 1
) wawf_810 ON TRUE
LEFT JOIN LATERAL (
  SELECT t.status, t.transmitted_at, t.lifecycle
  FROM ll_edi_transmissions t
  WHERE t.parent_table = 'kaj'
    AND t.parent_id = s.id
    AND t.edi_type = '856'
  ORDER BY t.transmitted_at DESC
  LIMIT 1
) wawf_856 ON TRUE;
