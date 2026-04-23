-- dbo.kbk_tab  (0 rows)
CREATE TABLE dbo.kbk_tab (
  idnkbk_kbk           int NOT NULL,
  addtme_kbk           datetime NOT NULL,
  addnme_kbk           char(10) NOT NULL,
  idnka2_kbk           int NOT NULL,
  idnkbh_kbk           int NOT NULL,
  sinqty_kbk           numeric(16,5) NOT NULL,
  PRIMARY KEY (idnkbk_kbk)
);