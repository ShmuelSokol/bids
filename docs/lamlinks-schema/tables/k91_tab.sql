-- dbo.k91_tab  (0 rows)
CREATE TABLE dbo.k91_tab (
  idnk91_k91           int NOT NULL,
  uptime_k91           datetime NOT NULL,
  upname_k91           char(10) NOT NULL,
  netdte_k91           datetime NOT NULL,
  idnk90_k91           int NOT NULL,
  dlyseq_k91           int NOT NULL,
  dlysss_k91           char(24) NOT NULL,
  reqdly_k91           datetime NOT NULL,
  untcst_k91           numeric(12,4) NOT NULL,
  po_qty_k91           numeric(16,5) NOT NULL,
  udsqty_k91           numeric(16,5) NOT NULL,
  snq_11_k91           numeric(16,5) NOT NULL,
  snq_12_k91           numeric(16,5) NOT NULL,
  srr_12_k91           numeric(16,5) NOT NULL,
  srq_11_k91           numeric(16,5) NOT NULL,
  soq_11_k91           numeric(16,5) NOT NULL,
  polext_k91           numeric(13,2) NOT NULL,
  polxvl_k91           numeric(13,2) NOT NULL,
  polval_k91           numeric(13,2) NOT NULL,
  PRIMARY KEY (idnk91_k91)
);