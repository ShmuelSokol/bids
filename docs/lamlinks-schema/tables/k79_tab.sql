-- dbo.k79_tab  (153128 rows)
CREATE TABLE dbo.k79_tab (
  idnk79_k79           int NOT NULL,
  uptime_k79           datetime NOT NULL,
  upname_k79           char(10) NOT NULL,
  idnk31_k79           int NOT NULL,
  rqmtyp_k79           char(20) NOT NULL,
  cntrct_k79           char(60) NOT NULL,
  cntdte_k79           datetime NOT NULL,
  PRIMARY KEY (idnk79_k79)
);