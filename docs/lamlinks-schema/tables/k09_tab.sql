-- dbo.k09_tab  (8802 rows)
CREATE TABLE dbo.k09_tab (
  idnk09_k09           int NOT NULL,
  uptime_k09           datetime NOT NULL,
  upname_k09           char(10) NOT NULL,
  b_stat_k09           char(20) NOT NULL,
  source_k09           char(20) NOT NULL,
  ref_no_k09           char(30) NOT NULL,
  refdte_k09           datetime NOT NULL,
  ourref_k09           char(30) NOT NULL,
  itmcnt_k09           int NOT NULL,
  c_clas_k09           varchar(12) NOT NULL DEFAULT ('DoD'),
  PRIMARY KEY (idnk09_k09)
);