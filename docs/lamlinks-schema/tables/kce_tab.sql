-- dbo.kce_tab  (0 rows)
CREATE TABLE dbo.kce_tab (
  idnkce_kce           int NOT NULL,
  addtme_kce           datetime NOT NULL,
  addnme_kce           char(10) NOT NULL,
  idnkcd_kce           int NOT NULL,
  idnk14_kce           int NOT NULL,
  actsta_kce           char(12) NOT NULL,
  acttme_kce           datetime NOT NULL,
  PRIMARY KEY (idnkce_kce)
);