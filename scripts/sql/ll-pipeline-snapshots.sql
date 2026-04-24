-- Pipeline snapshots — Windows worker periodically queries llk_db1
-- and writes a row here so /ops/dibs-pipeline can show real-time LL
-- health without Railway reaching the LL DB directly.

CREATE TABLE IF NOT EXISTS ll_pipeline_snapshots (
  id                 bigserial primary key,
  snapshot_time      timestamptz NOT NULL DEFAULT now(),

  -- Stuck staged: o_stat='adding quotes' for ajoseph, older than 5 min.
  -- These should always be 0 once the envelope-finalization patch is deployed;
  -- >0 means the patch failed or Abe has an in-progress draft (expected).
  stuck_staged_count integer NOT NULL DEFAULT 0,
  stuck_staged_samples jsonb,

  -- Unshipped: o_stat='quotes added' AND t_stat='not sent', aged > 10 min.
  -- >0 means either LL's transmit daemon is stuck, or nobody has clicked Post
  -- in LL yet. Matters because these bids aren't at DLA.
  unshipped_count    integer NOT NULL DEFAULT 0,
  unshipped_samples  jsonb,

  -- k81 award rows added in last 7 days whose idnk34 link points to a
  -- deleted/missing k34. These are DLA awards we can't link back to the bid.
  orphan_awards_count integer NOT NULL DEFAULT 0,
  orphan_awards_samples jsonb,

  -- Recent ajoseph envelopes (last 24h) for the activity feed panel.
  recent_envelopes   jsonb,

  -- Raw error if snapshot itself failed
  snapshot_error     text
);

CREATE INDEX IF NOT EXISTS ll_pipeline_snapshots_time_idx ON ll_pipeline_snapshots (snapshot_time DESC);
