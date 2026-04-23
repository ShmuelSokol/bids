-- dbo.k61_tab  (10347 rows)
CREATE TABLE dbo.k61_tab (
  idnk61_k61           int NOT NULL,
  uptime_k61           datetime NOT NULL,
  upname_k61           char(10) NOT NULL,
  f_stat_k61           char(20) NOT NULL,
  fyiref_k61           char(20) NOT NULL,
  refdte_k61           datetime NOT NULL,
  itmcnt_k61           int NOT NULL,
  PRIMARY KEY (idnk61_k61)
);