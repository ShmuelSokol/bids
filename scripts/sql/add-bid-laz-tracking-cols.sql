-- Track bid SFTP .laz upload result on each bid write queue row.
-- The .laz upload to sftp.lamlinks.com:/incoming/ is what actually transmits
-- the bid to DLA via Sally; the SQL writeback (k33/k34/k35) is LL-side audit.
-- Captured 2026-04-29 via procmon — see docs/runbooks/capture-bid-post-trace.md
-- and src/lib/ll-qtb-dbf.ts for the qtb_tab format.
ALTER TABLE public.lamlinks_write_queue
  ADD COLUMN IF NOT EXISTS ll_bid_laz_filename text,
  ADD COLUMN IF NOT EXISTS ll_bid_dry_run boolean DEFAULT false;
