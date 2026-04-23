-- dbo.ka9_tab  (262873 rows)
CREATE TABLE dbo.ka9_tab (
  idnka9_ka9           int NOT NULL,
  uptime_ka9           datetime NOT NULL,
  upname_ka9           char(10) NOT NULL,
  idnka8_ka9           int NOT NULL,
  idnk81_ka9           int NOT NULL,
  idnkae_ka9           int NOT NULL,
  idnkaj_ka9           int NOT NULL,
  jln_no_ka9           int NOT NULL,
  jlndte_ka9           datetime NOT NULL,
  jrqpur_ka9           char(16) NOT NULL,
  jlnqty_ka9           int NOT NULL,
  jlnsta_ka9           char(32) NOT NULL,
  jlnsdt_ka9           datetime NOT NULL,
  pinval_ka9           numeric(13,2) NOT NULL,
  xinval_ka9           numeric(13,2) NOT NULL,
  potval_ka9           numeric(13,2) NOT NULL,
  selval_ka9           numeric(13,2) NOT NULL,
  PRIMARY KEY (idnka9_ka9)
);