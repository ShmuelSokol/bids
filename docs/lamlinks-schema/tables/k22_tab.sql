-- dbo.k22_tab  (0 rows)
CREATE TABLE dbo.k22_tab (
  idnk22_k22           int NOT NULL,
  uptime_k22           datetime NOT NULL,
  upname_k22           char(10) NOT NULL,
  usfnam_k22           char(32) NOT NULL,
  usfdes_k22           char(80) NOT NULL,
  itmcnt_k22           int NOT NULL,
  PRIMARY KEY (idnk22_k22)
);