-- dbo.kal_tab  (292761 rows)
CREATE TABLE dbo.kal_tab (
  idnkal_kal           int NOT NULL,
  adddte_kal           datetime NOT NULL,
  idnkap_kal           int NOT NULL,
  fpltbl_kal           char(3) NOT NULL,
  idnfpl_kal           int NOT NULL,
  ftitle_kal           char(80) NOT NULL,
  f_date_kal           datetime NOT NULL,
  f_vrno_kal           char(16) NOT NULL,
  filnam_kal           char(32) NOT NULL,
  fvtype_kal           char(1) NOT NULL DEFAULT ('V'),
  PRIMARY KEY (idnkal_kal)
);