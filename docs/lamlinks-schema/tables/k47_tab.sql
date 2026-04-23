-- dbo.k47_tab  (0 rows)
CREATE TABLE dbo.k47_tab (
  idnk47_k47           int NOT NULL,
  uptime_k47           datetime NOT NULL,
  upname_k47           char(10) NOT NULL,
  idnk46_k47           int NOT NULL,
  msgioo_k47           char(3) NOT NULL,
  mstat_k47            char(10) NOT NULL,
  msgtme_k47           datetime NOT NULL,
  subjct_k47           char(80) NOT NULL,
  frmadr_k47           char(80) NOT NULL,
  frmnam_k47           char(80) NOT NULL,
  tooadr_k47           char(80) NOT NULL,
  toonam_k47           char(80) NOT NULL,
  nodeid_k47           char(15) NOT NULL,
  msg_id_k47           char(80) NOT NULL,
  apttyp_k47           char(3) NOT NULL,
  idnapt_k47           int NOT NULL,
  msgtxt_k47           text(2147483647) NOT NULL,
  PRIMARY KEY (idnk47_k47)
);