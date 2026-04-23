-- dbo.kcg_tab  (1856478 rows)
CREATE TABLE dbo.kcg_tab (
  idnkcg_kcg           int NOT NULL,
  adddte_kcg           datetime NOT NULL,
  upddte_kcg           datetime NOT NULL,
  idnk09_kcg           int NOT NULL,
  idnkc4_kcg           int NOT NULL,
  prdqty_kcg           int NOT NULL,
  fatqty_kcg           int NOT NULL,
  optqty_kcg           int NOT NULL,
  othqty_kcg           int NOT NULL,
  idsind_kcg           char(1) NOT NULL,
  naics1_kcg           char(5) NOT NULL,
  xmlstr_kcg           text(2147483647) NOT NULL,
  PRIMARY KEY (idnkcg_kcg)
);