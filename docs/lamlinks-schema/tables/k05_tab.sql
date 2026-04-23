-- dbo.k05_tab  (0 rows)
CREATE TABLE dbo.k05_tab (
  idnk05_k05           int NOT NULL,
  adtime_k05           datetime NOT NULL,
  adname_k05           char(10) NOT NULL,
  idnk02_k05           int NOT NULL,
  idnk04_k05           int NOT NULL,
  clin_k05             char(6) NOT NULL,
  invqty_k05           int NOT NULL,
  inv_ui_k05           char(2) NOT NULL,
  inv_up_k05           numeric(12,4) NOT NULL,
  invext_k05           numeric(12,2) NOT NULL,
  pidtyp_k05           char(2) NOT NULL,
  pid_no_k05           char(37) NOT NULL,
  mcage_k05            char(5) NOT NULL,
  mpn_k05              char(32) NOT NULL,
  nsn_k05              char(16) NOT NULL,
  desc_k05             char(80) NOT NULL,
  PRIMARY KEY (idnk05_k05)
);