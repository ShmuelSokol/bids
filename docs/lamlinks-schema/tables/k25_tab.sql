-- dbo.k25_tab  (20 rows)
CREATE TABLE dbo.k25_tab (
  idnk25_k25           int NOT NULL,
  uptime_k25           datetime NOT NULL,
  upname_k25           char(10) NOT NULL,
  clrnam_k25           char(32) NOT NULL,
  rbgfun_k25           char(24) NOT NULL,
  PRIMARY KEY (idnk25_k25)
);