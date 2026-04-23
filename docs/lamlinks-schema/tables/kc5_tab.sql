-- dbo.kc5_tab  (11793 rows)
CREATE TABLE dbo.kc5_tab (
  idnkc5_kc5           int NOT NULL,
  addtme_kc5           datetime NOT NULL,
  addnme_kc5           char(10) NOT NULL,
  i_stat_kc5           char(32) NOT NULL,
  i_time_kc5           datetime NOT NULL,
  dnltyp_kc5           char(20) NOT NULL,
  ref_no_kc5           char(30) NOT NULL,
  refdte_kc5           datetime NOT NULL,
  dnldes_kc5           char(40) NOT NULL,
  filnam_kc5           char(15) NOT NULL,
  bytsiz_kc5           int NOT NULL,
  itmcnt_kc5           int NOT NULL,
  PRIMARY KEY (idnkc5_kc5)
);