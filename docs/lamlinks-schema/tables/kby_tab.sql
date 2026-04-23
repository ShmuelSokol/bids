-- dbo.kby_tab  (0 rows)
CREATE TABLE dbo.kby_tab (
  idnkby_kby           int NOT NULL,
  uptime_kby           datetime NOT NULL,
  upname_kby           char(10) NOT NULL,
  idnkbx_kby           int NOT NULL,
  m2rseq_kby           int NOT NULL,
  rrstbl_kby           char(3) NOT NULL,
  idnrrs_kby           int NOT NULL,
  ciptyp_kby           char(32) NOT NULL,
  ckrval_kby           numeric(13,2) NOT NULL,
  PRIMARY KEY (idnkby_kby)
);