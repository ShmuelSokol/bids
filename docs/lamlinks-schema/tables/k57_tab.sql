-- dbo.k57_tab  (117 rows)
CREATE TABLE dbo.k57_tab (
  idnk57_k57           int NOT NULL,
  uptime_k57           datetime NOT NULL,
  upname_k57           char(10) NOT NULL,
  idnk56_k57           int NOT NULL,
  minqty_k57           int NOT NULL,
  maxqty_k57           int NOT NULL,
  untcst_k57           numeric(12,4) NOT NULL,
  dlyaro_k57           int NOT NULL,
  valdte_k57           datetime NOT NULL,
  fobtyp_k57           char(12) NOT NULL,
  fobzip_k57           char(40) NOT NULL,
  PRIMARY KEY (idnk57_k57)
);