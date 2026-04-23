-- dbo.k35_tab  (496053 rows)
CREATE TABLE dbo.k35_tab (
  idnk35_k35           int NOT NULL,
  uptime_k35           datetime NOT NULL,
  upname_k35           char(10) NOT NULL,
  idnk34_k35           int NOT NULL,
  qty_k35              int NOT NULL,
  up_k35               numeric(12,4) NOT NULL,
  daro_k35             int NOT NULL,
  clin_k35             char(6) NOT NULL,
  PRIMARY KEY (idnk35_k35)
);