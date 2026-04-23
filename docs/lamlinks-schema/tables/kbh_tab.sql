-- dbo.kbh_tab  (0 rows)
CREATE TABLE dbo.kbh_tab (
  idnkbh_kbh           int NOT NULL,
  adddte_kbh           datetime NOT NULL,
  idnk98_kbh           int NOT NULL,
  idnrcv_kbh           int NOT NULL,
  invk96_kbh           int NOT NULL,
  pklseq_kbh           int NOT NULL,
  locatn_kbh           char(32) NOT NULL,
  instat_kbh           char(20) NOT NULL,
  crtsta_kbh           char(20) NOT NULL,
  pklqty_kbh           numeric(16,5) NOT NULL,
  rcvqty_kbh           numeric(16,5) NOT NULL,
  asiqty_kbh           numeric(16,5) NOT NULL,
  rcvval_kbh           numeric(13,2) NOT NULL,
  rcvtab_kbh           char(3) NOT NULL DEFAULT ('k90'),
  PRIMARY KEY (idnkbh_kbh)
);