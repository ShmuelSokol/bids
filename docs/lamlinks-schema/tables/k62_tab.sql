-- dbo.k62_tab  (1110318 rows)
CREATE TABLE dbo.k62_tab (
  idnk62_k62           int NOT NULL,
  uptime_k62           datetime NOT NULL,
  upname_k62           char(10) NOT NULL,
  idnk61_k62           int NOT NULL,
  seq_no_k62           int NOT NULL,
  fyttrt_k62           char(30) NOT NULL,
  fytods_k62           varchar(240) NOT NULL,
  PRIMARY KEY (idnk62_k62)
);