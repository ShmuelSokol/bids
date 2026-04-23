-- dbo.kcd_tab  (0 rows)
CREATE TABLE dbo.kcd_tab (
  idnkcd_kcd           int NOT NULL,
  addtme_kcd           datetime NOT NULL,
  addnme_kcd           char(10) NOT NULL,
  idnkcb_kcd           int NOT NULL,
  idnkcc_kcd           int NOT NULL,
  actcnt_kcd           int NOT NULL,
  n_stat_kcd           char(12) NOT NULL,
  n_time_kcd           datetime NOT NULL,
  PRIMARY KEY (idnkcd_kcd)
);