-- dbo.d02_tab  (3 rows)
CREATE TABLE dbo.d02_tab (
  idnd02_d02           int NOT NULL,
  addtme_d02           datetime NOT NULL,
  addnme_d02           char(10) NOT NULL,
  sysnam_d02           char(80) NOT NULL,
  wrknam_d02           char(80) NOT NULL,
  wrkfun_d02           char(80) NOT NULL,
  wrkprm_d02           char(240) NOT NULL,
  PRIMARY KEY (idnd02_d02)
);