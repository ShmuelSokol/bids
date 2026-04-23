-- dbo.kcl_tab  (16299 rows)
CREATE TABLE dbo.kcl_tab (
  idnkcl_kcl           int NOT NULL,
  adtime_kcl           datetime NOT NULL,
  uptime_kcl           datetime NOT NULL,
  idnkan_kcl           int NOT NULL,
  tblsnx_kcl           char(3) NOT NULL,
  idnsnx_kcl           int NOT NULL,
  x_stat_kcl           varchar(16) NOT NULL,
  x_clas_kcl           varchar(10) NOT NULL,
  x_name_kcl           varchar(32) NOT NULL,
  PRIMARY KEY (idnkcl_kcl)
);