-- Per-NSN cache of the most recent Procurement Item Description (PID)
-- + Contract Packaging Requirements from LamLinks kah_tab. LL attaches
-- these to k81_tab (awarded contract line) — so we can only surface
-- PID/packaging for NSNs ERG has previously been awarded. Still useful:
-- when a new sol comes in for an NSN we've won before, we show Abe the
-- last PID we received so he doesn't have to open LamLinks to read it.
--
-- Keyed by (fsc, niin). One row per NSN, always the most-recent k81.

CREATE TABLE IF NOT EXISTS ll_item_pids (
  id BIGSERIAL PRIMARY KEY,
  fsc TEXT NOT NULL,
  niin TEXT NOT NULL,
  pid_text TEXT,                         -- 'Procurement Item Description' from kah_tab
  packaging_text TEXT,                   -- 'Contract Packaging Requirements'
  packaging_notes TEXT,                  -- 'Packaging Notes' (free-form)
  source_idnk81 INTEGER,                 -- most recent k81_tab.idnk81_k81 source
  last_award_date TIMESTAMPTZ,           -- k81.uptime_k81 of the source row
  pid_bytes INTEGER,                     -- convenience: length of pid_text
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fsc, niin)
);
CREATE INDEX IF NOT EXISTS ll_item_pids_niin_idx ON ll_item_pids(niin);
