-- dbo.kdj_tab  (0 rows)
CREATE TABLE dbo.kdj_tab (
  idnkdj_kdj           int NOT NULL,
  adtime_kdj           datetime NOT NULL,
  uptime_kdj           datetime NOT NULL,
  idnk12_kdj           int NOT NULL,
  ceclas_kdj           char(32) NOT NULL,
  ecstat_kdj           char(32) NOT NULL,
  emstat_kdj           char(32) NOT NULL,
  PRIMARY KEY (idnkdj_kdj)
);