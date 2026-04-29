-- Add per-each cost + pack multiplier columns so pricing logic can compare
-- AX cost (per pack, e.g. B25) against DLA sol UoM (per EA) without 25x errors.
-- See `src/lib/uom.ts` and `docs/gotchas.md` § "UoM B-prefix codes".

ALTER TABLE public.nsn_costs
  ADD COLUMN IF NOT EXISTS pack_multiplier integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cost_per_each numeric;

ALTER TABLE public.nsn_vendor_prices
  ADD COLUMN IF NOT EXISTS pack_multiplier integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS price_per_each numeric;

-- Backfill: B25/B10/B100 etc. → pack_multiplier=NN, cost_per_each=cost/NN
-- Other recognised single-unit UoMs (EA/PR/PG/etc.) → multiplier=1
UPDATE public.nsn_costs
SET pack_multiplier = CASE
      WHEN unit_of_measure ~ '^B[0-9]+$' THEN substring(unit_of_measure from 2)::integer
      ELSE 1
    END,
    cost_per_each = CASE
      WHEN unit_of_measure ~ '^B[0-9]+$' AND substring(unit_of_measure from 2)::integer > 0
        THEN cost / substring(unit_of_measure from 2)::integer
      ELSE cost
    END
WHERE cost_per_each IS NULL;

UPDATE public.nsn_vendor_prices
SET pack_multiplier = CASE
      WHEN unit_of_measure ~ '^B[0-9]+$' THEN substring(unit_of_measure from 2)::integer
      ELSE 1
    END,
    price_per_each = CASE
      WHEN unit_of_measure ~ '^B[0-9]+$' AND substring(unit_of_measure from 2)::integer > 0
        THEN price / substring(unit_of_measure from 2)::integer
      ELSE price
    END
WHERE price_per_each IS NULL;
