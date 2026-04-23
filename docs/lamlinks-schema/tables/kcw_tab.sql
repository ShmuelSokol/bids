-- dbo.kcw_tab  (0 rows)
CREATE TABLE dbo.kcw_tab (
  idnkcw_kcw           int NOT NULL,
  adtime_kcw           datetime NOT NULL,
  uptime_kcw           datetime NOT NULL,
  cark12_kcw           int NOT NULL,
  cack12_kcw           int NOT NULL,
  viakap_kcw           int NOT NULL,
  typkap_kcw           int NOT NULL,
  cactyp_kcw           varchar(12) NOT NULL,
  cactno_kcw           varchar(32) NOT NULL,
  PRIMARY KEY (idnkcw_kcw)
);