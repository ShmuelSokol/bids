-- Auto-research pipeline for NSN supplier discovery.
-- See docs/research-pipeline.md (to be written).

-- Configurable settings (key/value, admin-editable)
CREATE TABLE IF NOT EXISTS research_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

INSERT INTO research_settings (key, value, description) VALUES
  ('daily_budget_usd', '20', 'Max $ of LLM API spend per day'),
  ('cache_fresh_days', '7', 'Research ≤ this many days old = reuse'),
  ('cache_stale_days', '30', 'Research > this many days old = re-run on next batch'),
  ('max_candidates_per_nsn', '6', 'How many supplier candidates to surface per NSN'),
  ('model_primary', 'claude-haiku-4-5-20251001', 'Claude model for research calls'),
  ('backfill_window_days', '14', 'How far back to backfill when first enabled'),
  ('research_enabled', 'true', 'Master kill-switch — turns off all new research')
ON CONFLICT (key) DO NOTHING;

-- Audit log: one row per LLM call (success or failure)
CREATE TABLE IF NOT EXISTS nsn_research_runs (
  id BIGSERIAL PRIMARY KEY,
  nsn TEXT NOT NULL,
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL,                    -- 'claude_haiku' | 'past_awards' | 'ax_supplier_match' | 'manual'
  status TEXT NOT NULL,                    -- 'ok' | 'error' | 'rate_limited' | 'over_budget' | 'no_results'
  cost_usd NUMERIC(8,4),                   -- what this call cost (for Claude, derived from token usage)
  duration_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  error_message TEXT,
  raw_response TEXT                        -- full LLM output for debugging (truncated at 20K chars)
);
CREATE INDEX IF NOT EXISTS nsn_research_runs_nsn_idx ON nsn_research_runs(nsn, run_at DESC);
CREATE INDEX IF NOT EXISTS nsn_research_runs_date_idx ON nsn_research_runs(run_at DESC);

-- Individual supplier candidates discovered by research
CREATE TABLE IF NOT EXISTS nsn_research_findings (
  id BIGSERIAL PRIMARY KEY,
  nsn TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  supplier_cage TEXT,                      -- null if unknown; verified against SAM.gov later
  supplier_url TEXT,
  product_url TEXT,
  list_price NUMERIC(12,2),
  qty_available INTEGER,
  moq INTEGER,
  lead_time_days INTEGER,
  is_manufacturer BOOLEAN,                 -- true = direct mfr; false = distributor
  erg_has_account BOOLEAN DEFAULT FALSE,   -- ERG-approved supplier cross-ref
  erg_has_past_po BOOLEAN DEFAULT FALSE,   -- have we bought from them before?
  past_po_count INTEGER DEFAULT 0,
  last_po_date TIMESTAMPTZ,
  confidence NUMERIC(3,2),                 -- 0.00–1.00
  source TEXT NOT NULL,                    -- 'claude_haiku' | 'past_awards' | 'ax_supplier_match'
  rationale TEXT,                          -- LLM's reason for suggesting; or "matched AX vendor account"
  found_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  superseded BOOLEAN NOT NULL DEFAULT FALSE  -- true after a newer research run replaces this
);
CREATE INDEX IF NOT EXISTS nsn_research_findings_nsn_idx ON nsn_research_findings(nsn, superseded, confidence DESC);
CREATE INDEX IF NOT EXISTS nsn_research_findings_cage_idx ON nsn_research_findings(supplier_cage);

-- One row per NSN — current research state (fast UI read)
CREATE TABLE IF NOT EXISTS nsn_research_status (
  nsn TEXT PRIMARY KEY,
  last_researched_at TIMESTAMPTZ,
  last_run_id BIGINT REFERENCES nsn_research_runs(id),
  candidate_count INTEGER NOT NULL DEFAULT 0,
  top_supplier_cage TEXT,
  top_supplier_name TEXT,
  top_list_price NUMERIC(12,2),
  top_confidence NUMERIC(3,2),
  any_erg_account BOOLEAN DEFAULT FALSE,     -- at least one candidate is an ERG-approved supplier
  any_past_po BOOLEAN DEFAULT FALSE,
  abe_verified_cage TEXT,                  -- Abe's override pick, persists across re-research
  abe_verified_at TIMESTAMPTZ,
  abe_notes TEXT,
  queue_status TEXT DEFAULT 'idle',        -- 'idle' | 'queued' | 'running' | 'failed'
  queued_at TIMESTAMPTZ,
  priority_score NUMERIC(14,2),            -- higher = research sooner
  refresh_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS nsn_research_status_queue_idx ON nsn_research_status(queue_status, priority_score DESC);
CREATE INDEX IF NOT EXISTS nsn_research_status_freshness_idx ON nsn_research_status(last_researched_at);

-- Abe's picks per bid (persists the chosen supplier for PO generation later)
CREATE TABLE IF NOT EXISTS nsn_supplier_picks (
  id BIGSERIAL PRIMARY KEY,
  nsn TEXT NOT NULL,
  solicitation_number TEXT,                -- which sol this pick is for (null = NSN-level default)
  bid_id INTEGER,                          -- later when bid_decisions has id
  chosen_supplier_name TEXT NOT NULL,
  chosen_supplier_cage TEXT,
  chosen_price NUMERIC(12,2),
  chosen_url TEXT,
  reason TEXT,                             -- Abe's free-text rationale
  picked_by TEXT,                          -- user id
  picked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active BOOLEAN NOT NULL DEFAULT TRUE     -- false when Abe changes his mind
);
CREATE INDEX IF NOT EXISTS nsn_supplier_picks_nsn_idx ON nsn_supplier_picks(nsn, active, picked_at DESC);
CREATE INDEX IF NOT EXISTS nsn_supplier_picks_sol_idx ON nsn_supplier_picks(solicitation_number, active);

-- Daily spend ledger (budget enforcement without summing runs every check)
CREATE TABLE IF NOT EXISTS research_spend_ledger (
  date DATE PRIMARY KEY,
  total_usd NUMERIC(10,4) NOT NULL DEFAULT 0,
  call_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
