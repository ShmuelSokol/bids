-- DLA payments received, mirrored from AX CustomerPaymentJournalLines
-- (filtered to OrderAccount/AccountDisplayValue='DD219' = DLA).
--
-- This is Phase 2 of the WAWF ack tracker. Once we know DLA paid an
-- invoice (matched on MarkedInvoice = "CIN" + LL.cinnum_kad), the
-- corresponding WAWF 810 transmission is definitively resolved — no
-- need to infer from age.

CREATE TABLE IF NOT EXISTS ax_dla_payments (
  id BIGSERIAL PRIMARY KEY,
  ax_voucher TEXT,                       -- AX Voucher (e.g. "CINV0065558")
  marked_invoice TEXT NOT NULL,          -- AX MarkedInvoice (e.g. "CIN0065068")
  marked_invoice_normalized TEXT NOT NULL, -- numeric portion only ("0065068") for LL match
  ax_company TEXT,                       -- MarkedInvoiceCompany ("szyh")
  customer_account TEXT NOT NULL,        -- AccountDisplayValue / OrderAccount
  customer_name TEXT,
  payment_amount NUMERIC(14,2),          -- CreditAmount
  payment_date TIMESTAMPTZ NOT NULL,     -- TransactionDate
  payment_reference TEXT,                -- PaymentReference
  payment_method TEXT,                   -- PaymentMethodName
  source_table TEXT NOT NULL,            -- 'CustomerPaymentJournalLines' or 'CustTransactions'
  source_recid BIGINT,                   -- AX SysRecId
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_table, source_recid)
);
CREATE INDEX IF NOT EXISTS ax_dla_payments_marked_idx ON ax_dla_payments(marked_invoice_normalized);
CREATE INDEX IF NOT EXISTS ax_dla_payments_date_idx ON ax_dla_payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS ax_dla_payments_customer_idx ON ax_dla_payments(customer_account);
