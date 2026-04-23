-- dbo.kbp_tab  (0 rows)
CREATE TABLE dbo.kbp_tab (
  idnkbp_kbp           int NOT NULL,
  uptime_kbp           datetime NOT NULL,
  upname_kbp           char(10) NOT NULL,
  idnkbn_kbp           int NOT NULL,
  wcrseq_kbp           int NOT NULL,
  crstbl_kbp           char(3) NOT NULL,
  idncrs_kbp           int NOT NULL,
  ckrtyp_kbp           char(32) NOT NULL,
  ckrval_kbp           numeric(13,2) NOT NULL,
  PRIMARY KEY (idnkbp_kbp)
);