-- dbo.kbq_tab  (0 rows)
CREATE TABLE dbo.kbq_tab (
  idnkbq_kbq           int NOT NULL,
  uptime_kbq           datetime NOT NULL,
  upname_kbq           char(10) NOT NULL,
  idnk12_kbq           int NOT NULL,
  pyrino_kbq           char(16) NOT NULL,
  pyrtbl_kbq           char(3) NOT NULL,
  idnpyr_kbq           int NOT NULL,
  pyrtyp_kbq           char(32) NOT NULL,
  pyrref_kbq           char(60) NOT NULL,
  pyrdte_kbq           datetime NOT NULL,
  pyrval_kbq           numeric(13,2) NOT NULL,
  PRIMARY KEY (idnkbq_kbq)
);