-- dbo.kd4_tab  (266 rows)
CREATE TABLE dbo.kd4_tab (
  idnkd4_kd4           int NOT NULL,
  adtime_kd4           datetime NOT NULL,
  idnkd3_kd4           int NOT NULL,
  idnkd6_kd4           int NOT NULL,
  idnk80_kd4           int NOT NULL,
  idnkal_kd4           int NOT NULL,
  cntrct_kd4           varchar(60) NOT NULL,
  rel_no_kd4           char(6) NOT NULL,
  modnum_kd4           varchar(32) NOT NULL,
  modate_kd4           datetime NOT NULL,
  modsrc_kd4           varchar(16) NOT NULL,
  modval_kd4           numeric(11,2) NOT NULL,
  modtxt_kd4           text(2147483647) NOT NULL,
  piidno_kd4           varchar(22) NOT NULL DEFAULT (''),
  PRIMARY KEY (idnkd4_kd4)
);