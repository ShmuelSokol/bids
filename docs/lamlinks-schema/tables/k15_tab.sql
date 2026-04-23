-- dbo.k15_tab  (902966 rows)
CREATE TABLE dbo.k15_tab (
  idnk15_k15           int NOT NULL,
  uptime_k15           datetime NOT NULL,
  upname_k15           char(10) NOT NULL,
  idnk08_k15           int NOT NULL,
  idnk13_k15           int NOT NULL,
  prtnum_k15           char(32) NOT NULL,
  rncc_k15             char(1) NOT NULL,
  rnvc_k15             char(1) NOT NULL,
  mcrsrc_k15           char(1) NOT NULL,
  dlasrc_k15           char(1) NOT NULL,
  dla_cc_k15           char(1) NOT NULL,
  dla_vc_k15           char(1) NOT NULL,
  aprved_k15           char(1) NOT NULL,
  ntgsrc_k15           char(1) NOT NULL,
  pn_rev_k15           char(2) NOT NULL,
  PRIMARY KEY (idnk15_k15)
);