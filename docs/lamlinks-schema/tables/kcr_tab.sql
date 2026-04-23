-- dbo.kcr_tab  (0 rows)
CREATE TABLE dbo.kcr_tab (
  idnkcr_kcr           int NOT NULL,
  adtime_kcr           datetime NOT NULL,
  uptime_kcr           datetime NOT NULL,
  idnk39_kcr           int NOT NULL,
  dmc_no_kcr           int NOT NULL,
  dmcnum_kcr           char(16) NOT NULL,
  dmcsta_kcr           char(16) NOT NULL,
  dbmval_kcr           numeric(13,2) NOT NULL,
  udmval_kcr           numeric(13,2) NOT NULL,
  dmcxml_kcr           text(2147483647) NOT NULL,
  PRIMARY KEY (idnkcr_kcr)
);