-- dbo.k24_tab  (3 rows)
CREATE TABLE dbo.k24_tab (
  idnk24_k24           int NOT NULL,
  uptime_k24           datetime NOT NULL,
  upname_k24           char(10) NOT NULL,
  sprnam_k24           char(32) NOT NULL,
  sprdes_k24           char(80) NOT NULL,
  spr_no_k24           numeric(7,3) NOT NULL,
  PRIMARY KEY (idnk24_k24)
);