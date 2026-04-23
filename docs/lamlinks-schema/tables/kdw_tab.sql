-- dbo.kdw_tab  (1 rows)
CREATE TABLE dbo.kdw_tab (
  idnkdw_kdw           int NOT NULL,
  adtime_kdw           datetime NOT NULL,
  uptime_kdw           datetime NOT NULL,
  idnk31_kdw           int NOT NULL,
  idnk06_kdw           int NOT NULL,
  c_clas_kdw           varchar(12) NOT NULL,
  c_stat_kdw           varchar(12) NOT NULL,
  c_cntr_kdw           varchar(80) NOT NULL,
  fob_od_kdw           char(1) NOT NULL,
  q_mode_kdw           varchar(32) NOT NULL,
  PRIMARY KEY (idnkdw_kdw)
);