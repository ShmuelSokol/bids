-- dbo.k41_tab  (1 rows)
CREATE TABLE dbo.k41_tab (
  idnk41_k41           int NOT NULL,
  uptime_k41           datetime NOT NULL,
  upname_k41           char(10) NOT NULL,
  idnk36_k41           int NOT NULL,
  bat_no_k41           int NOT NULL,
  addtme_k41           datetime NOT NULL,
  nodelk_k41           char(16) NOT NULL,
  bt_sta_k41           char(32) NOT NULL,
  bt_tme_k41           datetime NOT NULL,
  rfqcnt_k41           int NOT NULL,
  PRIMARY KEY (idnk41_k41)
);