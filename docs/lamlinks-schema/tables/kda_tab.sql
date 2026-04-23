-- dbo.kda_tab  (0 rows)
CREATE TABLE dbo.kda_tab (
  idnkda_kda           int NOT NULL,
  adtime_kda           datetime NOT NULL,
  uptime_kda           datetime NOT NULL,
  idnkd8_kda           int NOT NULL,
  qteqty_kda           numeric(12,3) NOT NULL,
  uprice_kda           numeric(12,3) NOT NULL,
  qte_ui_kda           char(2) NOT NULL,
  dlyaro_kda           int NOT NULL,
  PRIMARY KEY (idnkda_kda)
);