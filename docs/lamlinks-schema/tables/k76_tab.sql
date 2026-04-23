-- dbo.k76_tab  (0 rows)
CREATE TABLE dbo.k76_tab (
  idnk76_k76           int NOT NULL,
  uptime_k76           datetime NOT NULL,
  upname_k76           char(10) NOT NULL,
  idnk75_k76           int NOT NULL,
  dcltyp_k76           char(32) NOT NULL,
  dclloc_k76           char(32) NOT NULL,
  dclnam_k76           char(80) NOT NULL,
  dclisc_k76           char(32) NOT NULL,
  dcltbl_k76           char(3) NOT NULL,
  idndcl_k76           int NOT NULL,
  filnam_k76           char(32) NOT NULL,
  PRIMARY KEY (idnk76_k76)
);