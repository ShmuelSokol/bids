-- dbo.kc6_tab  (0 rows)
CREATE TABLE dbo.kc6_tab (
  idnkc6_kc6           int NOT NULL,
  adddte_kc6           datetime NOT NULL,
  upname_kc6           char(10) NOT NULL,
  idnkap_kc6           int NOT NULL,
  idnk96_kc6           int NOT NULL,
  mdr_no_kc6           int NOT NULL,
  mdrnum_kc6           char(16) NOT NULL,
  mdrdte_kc6           datetime NOT NULL,
  mdrdes_kc6           char(80) NOT NULL,
  mdrsta_kc6           char(16) NOT NULL,
  mdrstm_kc6           datetime NOT NULL,
  invval_kc6           numeric(13,2) NOT NULL,
  PRIMARY KEY (idnkc6_kc6)
);