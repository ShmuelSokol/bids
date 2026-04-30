-- RFQ drafts queue. Each row = one outbound RFQ email Abe will review
-- before sending. One row per (supplier, batch-of-NSNs) — multiple NSNs
-- to the same supplier are grouped into one draft to match Abe's actual
-- pattern (he sends "please quote me on these NSNs" with several lines).
--
-- Lifecycle:
--   draft → sent → responded (manual mark by Abe or by inbox auto-parse)
--                  expired (no response in N days)
--                  cancelled (Abe rejected before sending)
--
-- Source tracking: where did this draft come from?
--   - 'sol_bulk'      Abe selected solicitations + clicked "Generate RFQs"
--   - 'auto_research' Auto-generated when research worker finds suppliers
--                     above confidence threshold
--   - 'manual'        Abe typed it in directly via /rfq UI
--   - 'followup'      Generated as a chase email after N days no-response

CREATE TABLE IF NOT EXISTS rfq_drafts (
  id              bigserial PRIMARY KEY,
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'pending_send', 'sending', 'sent', 'send_failed', 'responded', 'expired', 'cancelled')),
  supplier_id     bigint REFERENCES dibs_suppliers(id) ON DELETE SET NULL,
  supplier_email  text NOT NULL,
  supplier_name   text NOT NULL,
  subject         text NOT NULL,
  body            text NOT NULL,
  -- Array of {nsn, partNumber, qty, description?} per RfqLine type
  lines           jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Source tracking
  sol_id          text,
  source          text NOT NULL DEFAULT 'manual'
                    CHECK (source IN ('sol_bulk', 'auto_research', 'manual', 'followup')),
  -- Lifecycle timestamps + identity
  created_by      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz,
  responded_at    timestamptz,
  expires_at      timestamptz,
  -- After send: EWS message id so we can track replies
  ews_uid         text,
  -- For response parsing later (Phase 2.3+)
  response_summary text,
  notes           text,
  -- Skip-reason if generator decided not to actually send (rate-limit, dedup, etc.)
  skip_reason     text,
  -- Send error message if EWS send failed
  send_error      text
);

CREATE INDEX IF NOT EXISTS rfq_drafts_status_idx ON rfq_drafts (status);
CREATE INDEX IF NOT EXISTS rfq_drafts_supplier_idx ON rfq_drafts (supplier_id);
CREATE INDEX IF NOT EXISTS rfq_drafts_sol_idx ON rfq_drafts (sol_id);
CREATE INDEX IF NOT EXISTS rfq_drafts_created_at_idx ON rfq_drafts (created_at DESC);
CREATE INDEX IF NOT EXISTS rfq_drafts_lines_gin ON rfq_drafts USING gin (lines);
