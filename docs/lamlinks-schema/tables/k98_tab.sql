-- dbo.k98_tab  (0 rows)
CREATE TABLE dbo.k98_tab (
  idnk98_k98           int NOT NULL,
  uptime_k98           datetime NOT NULL,
  upname_k98           char(10) NOT NULL,
  idnkbj_k98           int NOT NULL,
  idnwhs_k98           int NOT NULL,
  ffwder_k98           int NOT NULL,
  plr_no_k98           char(32) NOT NULL,
  pl_dte_k98           datetime NOT NULL,
  rcvdte_k98           datetime NOT NULL,
  boxcnt_k98           int NOT NULL,
  weight_k98           numeric(10,1) NOT NULL,
  trakno_k98           char(30) NOT NULL,
  pl_val_k98           numeric(13,2) NOT NULL,
  PRIMARY KEY (idnk98_k98)
);