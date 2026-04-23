-- dbo.k07_tab  (2229 rows)
CREATE TABLE dbo.k07_tab (
  idnk07_k07           int NOT NULL,
  uptime_k07           datetime NOT NULL,
  upname_k07           char(10) NOT NULL,
  ss_tid_k07           char(1) NOT NULL,
  ss_idk_k07           char(32) NOT NULL,
  ss_key_k07           char(64) NOT NULL,
  ss_val_k07           char(80) NOT NULL,
  ssmemo_k07           text(2147483647),
  PRIMARY KEY (idnk07_k07)
);