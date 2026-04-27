-- lamlinks_rest_queue: Sally REST API call queue.
-- DIBS API routes INSERT a pending row; the worker on NYEVRVTC001
-- (which is whitelisted at api.lamlinks.com) picks up pending rows,
-- spawns LL's bundled curl with digest auth, parses the response,
-- and updates the row.
--
-- See docs/architecture/sally-rest-worker.md for the full design.

CREATE TABLE IF NOT EXISTS public.lamlinks_rest_queue (
  id              BIGSERIAL PRIMARY KEY,
  lis_function    TEXT NOT NULL,
  e_code          TEXT NOT NULL DEFAULT '0AG09',
  req_data_xml    TEXT NOT NULL DEFAULT '',
  wait_seconds    INTEGER NOT NULL DEFAULT 30,
  state           TEXT NOT NULL DEFAULT 'pending'
                  CHECK (state IN ('pending','running','done','error','timeout')),
  enqueued_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  http_status     INTEGER,
  completion_code INTEGER,
  response_xml    TEXT,
  error_message   TEXT,
  enqueued_by     TEXT,
  related_kind    TEXT,
  related_id      TEXT,
  worker_host     TEXT
);

CREATE INDEX IF NOT EXISTS idx_lamlinks_rest_queue_pending
  ON public.lamlinks_rest_queue (state, enqueued_at)
  WHERE state IN ('pending','running');

CREATE INDEX IF NOT EXISTS idx_lamlinks_rest_queue_related
  ON public.lamlinks_rest_queue (related_kind, related_id)
  WHERE related_id IS NOT NULL;

ALTER TABLE public.lamlinks_rest_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lamlinks_rest_queue_service_all ON public.lamlinks_rest_queue;
CREATE POLICY lamlinks_rest_queue_service_all
  ON public.lamlinks_rest_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
