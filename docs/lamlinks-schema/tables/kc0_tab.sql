-- dbo.kc0_tab  (1906 rows)
CREATE TABLE dbo.kc0_tab (
  idnkc0_kc0           int NOT NULL,
  adddte_kc0           datetime NOT NULL,
  addnme_kc0           char(10) NOT NULL,
  payref_kc0           char(20) NOT NULL,
  refdte_kc0           datetime NOT NULL,
  f_stat_kc0           char(20) NOT NULL,
  paycnt_kc0           int NOT NULL,
  payval_kc0           numeric(13,2) NOT NULL,
  PRIMARY KEY (idnkc0_kc0)
);