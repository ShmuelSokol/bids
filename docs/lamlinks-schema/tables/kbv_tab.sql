-- dbo.kbv_tab  (0 rows)
CREATE TABLE dbo.kbv_tab (
  idnkbv_kbv           int NOT NULL,
  uptime_kbv           datetime NOT NULL,
  upname_kbv           char(10) NOT NULL,
  idnk12_kbv           int NOT NULL,
  pyrino_kbv           char(16) NOT NULL,
  pyrtbl_kbv           char(3) NOT NULL,
  idnpyr_kbv           int NOT NULL,
  pyrtyp_kbv           char(32) NOT NULL,
  pyrref_kbv           char(60) NOT NULL,
  pyrdte_kbv           datetime NOT NULL,
  pyrval_kbv           numeric(13,2) NOT NULL,
  PRIMARY KEY (idnkbv_kbv)
);