-- lamlinks_invoice_queue: AX→LL invoice writeback queue.
-- DIBS pulls DD219 invoices from AX and enqueues one row per AX invoice.
-- Worker on the daemon host drains the queue, writes kad+kae rows to
-- LamLinks (via msnodesqlv8 + Trusted_Connection), and flips state.
--
-- Lifecycle:
--   pending  → row freshly enqueued from AX
--   processing → worker claimed it, INSERTing kad/kae
--   draft    → kad+kae written to LL with cinsta_kad='Not Posted'
--                (Abe can review before Post All)
--   posted   → cinsta_kad flipped to Posted; LL daemon will EDI 810 to DLA
--   error    → terminal failure with error_message set

DROP TABLE IF EXISTS public.lamlinks_invoice_queue;
CREATE TABLE public.lamlinks_invoice_queue (
  id                          BIGSERIAL PRIMARY KEY,
  ax_invoice_number           TEXT NOT NULL,
  ax_sales_order              TEXT,
  ax_customer                 TEXT NOT NULL DEFAULT 'DD219',
  ax_customer_order_reference TEXT,
  ax_invoice_date             DATE,
  ax_total_amount             NUMERIC(12, 2),
  -- Lines: array of { productNumber, productDescription, invoicedQuantity,
  --                   salesPrice, uom, lineAmount }
  ax_lines                    JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Lifecycle
  state                       TEXT NOT NULL DEFAULT 'pending'
                              CHECK (state IN ('pending','processing','draft','posted','error')),
  enqueued_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  picked_up_at                TIMESTAMPTZ,
  drafted_at                  TIMESTAMPTZ,
  posted_at                   TIMESTAMPTZ,
  -- LL-side ids after kad+kae written
  ll_idnkad                   INTEGER,
  ll_cin_no                   TEXT,
  ll_kae_ids                  INTEGER[],
  -- Worker / errors
  worker_host                 TEXT,
  error_message               TEXT,
  enqueued_by                 TEXT,
  -- Idempotency: don't enqueue the same AX invoice twice in one day
  UNIQUE (ax_invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_lamlinks_invoice_queue_state
  ON public.lamlinks_invoice_queue (state, enqueued_at);

CREATE INDEX IF NOT EXISTS idx_lamlinks_invoice_queue_date
  ON public.lamlinks_invoice_queue (ax_invoice_date DESC);

ALTER TABLE public.lamlinks_invoice_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lamlinks_invoice_queue_service_all ON public.lamlinks_invoice_queue;
CREATE POLICY lamlinks_invoice_queue_service_all
  ON public.lamlinks_invoice_queue
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
