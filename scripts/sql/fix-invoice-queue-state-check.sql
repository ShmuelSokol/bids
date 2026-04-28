-- The 'approved' state was added in worker code (post-all flips pending→approved
-- so the worker drains 'approved' rows) but the CHECK constraint on the table
-- still only allowed pending/processing/draft/posted/error/timeout.

ALTER TABLE public.lamlinks_invoice_queue
  DROP CONSTRAINT IF EXISTS lamlinks_invoice_queue_state_check;

ALTER TABLE public.lamlinks_invoice_queue
  ADD CONSTRAINT lamlinks_invoice_queue_state_check
  CHECK (state IN ('pending','approved','processing','draft','posted','error','timeout'));
