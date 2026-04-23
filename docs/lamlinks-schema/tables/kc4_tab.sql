-- dbo.kc4_tab  (1846363 rows)
CREATE TABLE dbo.kc4_tab (
  idnkc4_kc4           int NOT NULL,
  adddte_kc4           datetime NOT NULL,
  upddte_kc4           datetime NOT NULL,
  idnk08_kc4           int NOT NULL,
  idnk10_kc4           int NOT NULL,
  c_stat_kc4           char(20) NOT NULL,
  c_time_kc4           datetime NOT NULL,
  cntrct_kc4           char(30) NOT NULL,
  rel_no_kc4           char(4) NOT NULL,
  reldte_kc4           datetime NOT NULL,
  a_cage_kc4           char(5) NOT NULL,
  awdqty_kc4           int NOT NULL,
  awd_um_kc4           char(2) NOT NULL,
  awd_up_kc4           numeric(15,5) NOT NULL,
  xmlstr_kc4           text(2147483647) NOT NULL DEFAULT (''),
  pkgcls_kc4           char(1) NOT NULL DEFAULT (''),
  srvqtt_kc4           int NOT NULL DEFAULT ((0)),
  k14own_kc4           int NOT NULL DEFAULT ((0)),
  piidno_kc4           varchar(22) NOT NULL DEFAULT (''),
  PRIMARY KEY (idnkc4_kc4)
);