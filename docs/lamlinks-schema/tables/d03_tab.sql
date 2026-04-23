-- dbo.d03_tab  (21 rows)
CREATE TABLE dbo.d03_tab (
  idnd03_d03           int NOT NULL,
  addtme_d03           datetime NOT NULL,
  addnme_d03           char(10) NOT NULL,
  idnd01_d03           int NOT NULL,
  idnd02_d03           int NOT NULL,
  jobtyp_d03           char(16) NOT NULL,
  workno_d03           int NOT NULL,
  rankno_d03           int NOT NULL,
  maxact_d03           int NOT NULL,
  autoaf_d03           char(1) NOT NULL,
  PRIMARY KEY (idnd03_d03)
);