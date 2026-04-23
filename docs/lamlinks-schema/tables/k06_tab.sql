-- dbo.k06_tab  (11 rows)
CREATE TABLE dbo.k06_tab (
  idnk06_k06           int NOT NULL,
  adtime_k06           datetime NOT NULL,
  adname_k06           char(10) NOT NULL,
  trmdes_k06           char(30) NOT NULL,
  dis_pc_k06           numeric(5,2) NOT NULL,
  disday_k06           int NOT NULL,
  netday_k06           int NOT NULL,
  PRIMARY KEY (idnk06_k06)
);