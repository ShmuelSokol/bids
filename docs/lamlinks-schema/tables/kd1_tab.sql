-- dbo.kd1_tab  (0 rows)
CREATE TABLE dbo.kd1_tab (
  idnkd1_kd1           int NOT NULL,
  uptime_kd1           datetime NOT NULL,
  upname_kd1           char(10) NOT NULL,
  idnkd0_kd1           int NOT NULL,
  xc_typ_kd1           char(4) NOT NULL,
  xc_cst_kd1           numeric(12,4) NOT NULL,
  xc_des_kd1           varchar(60) NOT NULL,
  PRIMARY KEY (idnkd1_kd1)
);