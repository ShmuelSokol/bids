-- Add sol_uom column so pricing logic can convert AX cost (per pack, e.g.
-- B25) to per-each when the SOL is in EA. Backfill from LL k11.sol_um_k11.
-- See `src/lib/uom.ts` and `docs/gotchas.md` § "UoM B-prefix codes".

ALTER TABLE public.dibbs_solicitations
  ADD COLUMN IF NOT EXISTS sol_uom text;

-- Index for the (sol_uom, bid_uom) lookup pattern used by reprice
CREATE INDEX IF NOT EXISTS idx_dibbs_sol_uom ON public.dibbs_solicitations(sol_uom);
