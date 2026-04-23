-- dbo.k30_tab  (1937101 rows)
CREATE TABLE dbo.k30_tab (
  idnk30_k30           int NOT NULL,
  uptime_k30           datetime NOT NULL,
  upname_k30           char(10) NOT NULL,
  idnk08_k30           int NOT NULL,
  idnk13_k30           int NOT NULL,
  idnk31_k30           int NOT NULL,
  cntrct_k30           char(18) NOT NULL,
  cntdte_k30           datetime NOT NULL,
  qty_k30              int NOT NULL,
  up_k30               numeric(12,3) NOT NULL,
  ui_k30               char(2) NOT NULL,
  PRIMARY KEY (idnk30_k30)
);