-- Track WAWF SFTP upload result on each invoice queue row.
ALTER TABLE public.lamlinks_invoice_queue
  ADD COLUMN IF NOT EXISTS ll_wawf_810_filename text,
  ADD COLUMN IF NOT EXISTS ll_wawf_856_filename text,
  ADD COLUMN IF NOT EXISTS ll_wawf_dry_run boolean DEFAULT false;
