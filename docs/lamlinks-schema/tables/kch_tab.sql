-- dbo.kch_tab  (132144 rows)
CREATE TABLE dbo.kch_tab (
  idnkch_kch           int NOT NULL,
  adtime_kch           datetime NOT NULL,
  taskid_kch           char(32) NOT NULL,
  rcltbl_kch           char(3) NOT NULL,
  idnrcl_kch           int NOT NULL,
  PRIMARY KEY (idnkch_kch)
);