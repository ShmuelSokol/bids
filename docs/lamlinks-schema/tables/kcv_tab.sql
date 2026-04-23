-- dbo.kcv_tab  (0 rows)
CREATE TABLE dbo.kcv_tab (
  idnkcv_kcv           int NOT NULL,
  adtime_kcv           datetime NOT NULL,
  uptime_kcv           datetime NOT NULL,
  idnkcu_kcv           int NOT NULL,
  srl_no_kcv           int NOT NULL,
  srlqty_kcv           int NOT NULL,
  srstab_kcv           char(3) NOT NULL,
  idnsrs_kcv           int NOT NULL,
  afttab_kcv           char(3) NOT NULL,
  idnaft_kcv           int NOT NULL,
  rtnsta_kcv           varchar(32) NOT NULL,
  rtndte_kcv           datetime NOT NULL,
  rtnqty_kcv           int NOT NULL,
  srlxml_kcv           text(2147483647) NOT NULL,
  PRIMARY KEY (idnkcv_kcv)
);