-- dbo.kag_tab  (0 rows)
CREATE TABLE dbo.kag_tab (
  idnkag_kag           int NOT NULL,
  adddte_kag           datetime NOT NULL,
  idnkac_kag           int NOT NULL,
  xlgval_kag           numeric(13,2) NOT NULL,
  xlgdes_kag           varchar(240) NOT NULL,
  PRIMARY KEY (idnkag_kag)
);