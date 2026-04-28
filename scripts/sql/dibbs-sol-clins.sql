-- Per-CLIN solicitation data scraped directly from DIBBS web UI.
-- LL's own DIBBS scraper misses CLINs on multi-CLIN sols (only captures
-- the first row in search results), which leaves DIBS with wrong qty/value
-- on those sols. This table stores the truth scraped from DIBBS Package
-- View, used to override LL data when there's a discrepancy.

CREATE TABLE IF NOT EXISTS public.dibbs_sol_clins (
  id              BIGSERIAL PRIMARY KEY,
  sol_no          TEXT NOT NULL,
  clin_no         TEXT NOT NULL,            -- e.g. '0001', '0002', '0003' (4-digit DLA convention)
  nsn             TEXT,                     -- per-CLIN NSN (usually same across the sol)
  fsc             TEXT,
  niin            TEXT,
  qty             INTEGER NOT NULL,
  uom             TEXT,                     -- 'EA', 'BX', 'PR', 'B25', etc.
  fob             TEXT,                     -- 'Origin' / 'Destination'
  delivery_days   INTEGER,                  -- ARO days
  dest_city       TEXT,
  dest_state      TEXT,
  dest_zip        TEXT,
  raw_html_snippet TEXT,                    -- audit trail — chunk of DIBBS HTML we parsed
  scraped_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  scrape_source   TEXT NOT NULL DEFAULT 'playwright_package_view',
  UNIQUE (sol_no, clin_no)
);

CREATE INDEX IF NOT EXISTS idx_dibbs_sol_clins_sol
  ON public.dibbs_sol_clins (sol_no);

CREATE INDEX IF NOT EXISTS idx_dibbs_sol_clins_scraped
  ON public.dibbs_sol_clins (scraped_at DESC);

ALTER TABLE public.dibbs_sol_clins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dibbs_sol_clins_service_all ON public.dibbs_sol_clins;
CREATE POLICY dibbs_sol_clins_service_all
  ON public.dibbs_sol_clins
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS dibbs_sol_clins_authenticated_read ON public.dibbs_sol_clins;
CREATE POLICY dibbs_sol_clins_authenticated_read
  ON public.dibbs_sol_clins
  FOR SELECT TO authenticated
  USING (true);
