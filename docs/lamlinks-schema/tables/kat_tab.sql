-- dbo.kat_tab  (47 rows)
CREATE TABLE dbo.kat_tab (
  idnkat_kat           int NOT NULL,
  idnkas_kat           int NOT NULL,
  rcolno_kat           int NOT NULL,
  exprsn_kat           char(10) NOT NULL,
  poptyp_kat           char(10) NOT NULL,
  popnam_kat           char(10) NOT NULL,
  popval_kat           varchar(7000) NOT NULL,
  PRIMARY KEY (idnkat_kat)
);