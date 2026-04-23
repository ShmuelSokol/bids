-- dbo.k72_tab  (0 rows)
CREATE TABLE dbo.k72_tab (
  idnk72_k72           int NOT NULL,
  uptime_k72           datetime NOT NULL,
  upname_k72           char(10) NOT NULL,
  idnnha_k72           int NOT NULL,
  idncmp_k72           int NOT NULL,
  seq_no_k72           int NOT NULL,
  itemno_k72           char(10) NOT NULL,
  cmpqty_k72           numeric(12,5) NOT NULL,
  qtyper_k72           char(20) NOT NULL,
  idnkd2_k72           int NOT NULL DEFAULT ((0)),
  PRIMARY KEY (idnk72_k72)
);