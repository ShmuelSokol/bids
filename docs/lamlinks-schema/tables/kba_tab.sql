-- dbo.kba_tab  (4 rows)
CREATE TABLE dbo.kba_tab (
  idnkba_kba           int NOT NULL,
  adddte_kba           datetime NOT NULL,
  idnkap_kba           int NOT NULL,
  idnk25_kba           int NOT NULL,
  idnk71_kba           int NOT NULL,
  shpft3_kba           numeric(15,3),
  box_wt_kba           numeric(12,2) NOT NULL,
  boxval_kba           numeric(8,2) NOT NULL,
  boxdes_kba           char(80) NOT NULL,
  PRIMARY KEY (idnkba_kba)
);