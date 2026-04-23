-- dbo.k49_tab  (0 rows)
CREATE TABLE dbo.k49_tab (
  idnk49_k49           int NOT NULL,
  uptime_k49           datetime NOT NULL,
  upname_k49           char(10) NOT NULL,
  idnk46_k49           int NOT NULL,
  msgioo_k49           char(3) NOT NULL,
  nodeid_k49           char(15) NOT NULL,
  msg_id_k49           char(220) NOT NULL,
  p_stat_k49           char(16) NOT NULL,
  subjct_k49           char(80) NOT NULL,
  faxnam_k49           char(60) NOT NULL,
  appnam_k49           char(32) NOT NULL,
  faxphn_k49           char(24) NOT NULL,
  faxpoc_k49           char(60) NOT NULL,
  msgtme_k49           datetime NOT NULL,
  faxpri_k49           char(3) NOT NULL,
  pagcnt_k49           int NOT NULL,
  apttyp_k49           char(3) NOT NULL,
  idnapt_k49           int NOT NULL,
  PRIMARY KEY (idnk49_k49)
);