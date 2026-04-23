-- dbo.kcb_tab  (1 rows)
CREATE TABLE dbo.kcb_tab (
  idnkcb_kcb           int NOT NULL,
  addtme_kcb           datetime NOT NULL,
  addnme_kcb           char(10) NOT NULL,
  netkap_kcb           int NOT NULL,
  idnkca_kcb           int NOT NULL,
  narnam_kcb           char(80) NOT NULL,
  ok2use_kcb           char(1) NOT NULL,
  n_when_kcb           char(32) NOT NULL,
  notrip_kcb           char(1) NOT NULL,
  sendby_kcb           char(1) NOT NULL,
  PRIMARY KEY (idnkcb_kcb)
);