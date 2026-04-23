-- dbo.kac_tab  (0 rows)
CREATE TABLE dbo.kac_tab (
  idnkac_kac           int NOT NULL,
  adddte_kac           datetime NOT NULL,
  idnka9_kac           int NOT NULL,
  expk96_kac           int NOT NULL,
  xfrval_kac           numeric(13,2) NOT NULL,
  xlgval_kac           numeric(13,2) NOT NULL,
  PRIMARY KEY (idnkac_kac)
);