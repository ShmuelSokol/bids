-- dbo.kdx_tab  (0 rows)
CREATE TABLE dbo.kdx_tab (
  idnkdx_kdx           int NOT NULL,
  adtime_kdx           datetime NOT NULL,
  idnk14_kdx           int NOT NULL,
  tbliec_kdx           varchar(32) NOT NULL,
  idniec_kdx           int NOT NULL,
  ecount_kdx           int NOT NULL,
  e_stat_kdx           varchar(12) NOT NULL,
  estime_kdx           datetime NOT NULL,
  subjct_kdx           char(80) NOT NULL,
  toonam_kdx           varchar(80) NOT NULL,
  tooadr_kdx           varchar(80) NOT NULL,
  msgtxt_kdx           text(2147483647) NOT NULL,
  PRIMARY KEY (idnkdx_kdx)
);