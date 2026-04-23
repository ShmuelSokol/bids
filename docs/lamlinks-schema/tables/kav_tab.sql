-- dbo.kav_tab  (68112 rows)
CREATE TABLE dbo.kav_tab (
  idnkav_kav           int NOT NULL,
  uptime_kav           datetime NOT NULL,
  upname_kav           char(10) NOT NULL,
  idnkbd_kav           int NOT NULL,
  xfvsbj_kav           varchar(240) NOT NULL,
  xfv_01_kav           varchar(240) NOT NULL,
  xfv_02_kav           varchar(240) NOT NULL,
  xfv_03_kav           varchar(240) NOT NULL,
  xfv_04_kav           varchar(240) NOT NULL,
  xfv_05_kav           varchar(240) NOT NULL,
  xfv_06_kav           varchar(240) NOT NULL,
  xfv_07_kav           varchar(240) NOT NULL,
  xfv_08_kav           varchar(240) NOT NULL,
  xfv_09_kav           varchar(240) NOT NULL,
  xfv_10_kav           varchar(240) NOT NULL,
  PRIMARY KEY (idnkav_kav)
);