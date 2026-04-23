-- dbo.kas_tab  (20 rows)
CREATE TABLE dbo.kas_tab (
  idnkas_kas           int NOT NULL,
  idnkar_kas           int NOT NULL,
  arowno_kas           int NOT NULL,
  rowuse_kas           char(10) NOT NULL,
  falign_kas           char(10) NOT NULL,
  rowhen_kas           char(24) NOT NULL,
  PRIMARY KEY (idnkas_kas)
);