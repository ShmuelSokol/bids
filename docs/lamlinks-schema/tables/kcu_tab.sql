-- dbo.kcu_tab  (0 rows)
CREATE TABLE dbo.kcu_tab (
  idnkcu_kcu           int NOT NULL,
  adtime_kcu           datetime NOT NULL,
  uptime_kcu           datetime NOT NULL,
  idnkcw_kcu           int NOT NULL,
  sprtyp_kcu           varchar(32) NOT NULL,
  spr_no_kcu           int NOT NULL,
  sprnum_kcu           char(16) NOT NULL,
  ormnum_kcu           varchar(80) NOT NULL,
  srssta_kcu           varchar(32) NOT NULL,
  srsdte_kcu           datetime NOT NULL,
  sprxml_kcu           text(2147483647) NOT NULL,
  PRIMARY KEY (idnkcu_kcu)
);