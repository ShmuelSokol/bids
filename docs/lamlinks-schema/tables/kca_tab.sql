-- dbo.kca_tab  (2 rows)
CREATE TABLE dbo.kca_tab (
  idnkca_kca           int NOT NULL,
  addtme_kca           datetime NOT NULL,
  addnme_kca           char(10) NOT NULL,
  aclass_kca           char(80) NOT NULL,
  PRIMARY KEY (idnkca_kca)
);