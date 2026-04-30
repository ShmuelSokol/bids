-- WAWF email parsed history. Each row = one WAWF acceptance/rejection email
-- we parsed from Abe's inbox via EWS. Used to:
--   1. Avoid double-processing the same email
--   2. Drive the /ops/wawf-emails UI page
--   3. Provide reconciliation evidence (kbr says sent + WAWF email confirms)
--
-- Schema deliberately minimal — we don't need every WAWF info/warning line,
-- just the structured outcome and a pointer to the source email if Abe wants
-- to look up details.

CREATE TABLE IF NOT EXISTS wawf_email_log (
  id              bigserial PRIMARY KEY,
  ews_uid         text UNIQUE NOT NULL,            -- Exchange item id, dedup key
  received_at     timestamptz NOT NULL,
  subject         text,
  form_type       text,                            -- '810' or '856' (or NULL)
  contract_no     text,                            -- e.g. 'SPE2DS26P1577'
  cin             text,                            -- AX-side CIN like '0066250'
  shipment_no     text,                            -- e.g. 'SZY0001Z'
  wawf_tcn        text,                            -- WAWF Transaction Set Control Number
  outcome         text NOT NULL,                   -- 'accepted', 'accepted_with_modifications', 'rejected', 'rejected_benign', 'unparseable'
  error_text      text,                            -- the ERROR: line(s) verbatim if reject
  matched_kaj     int,                             -- LL kaj_id we matched this email to (NULL if no match)
  kbr_action      text,                            -- 'tcn_updated', 'kbr_restored', 'no_action', 'alerted'
  alerted         boolean NOT NULL DEFAULT false,  -- whether WhatsApp went out
  raw_body        text,                            -- full email body for forensics
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wawf_email_log_received_at_idx ON wawf_email_log (received_at DESC);
CREATE INDEX IF NOT EXISTS wawf_email_log_cin_idx ON wawf_email_log (cin);
CREATE INDEX IF NOT EXISTS wawf_email_log_outcome_idx ON wawf_email_log (outcome);
CREATE INDEX IF NOT EXISTS wawf_email_log_kaj_idx ON wawf_email_log (matched_kaj);
