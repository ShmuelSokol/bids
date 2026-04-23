-- dbo.d04_tab  (3 rows)
CREATE TABLE dbo.d04_tab (
  idnd04_d04           int NOT NULL,
  addtme_d04           datetime NOT NULL,
  addnme_d04           char(10) NOT NULL,
  idnd01_d04           int NOT NULL,
  idnd03_d04           int NOT NULL,
  actseq_d04           int NOT NULL,
  nodseq_d04           int NOT NULL,
  taskid_d04           char(16) NOT NULL,
  loginn_d04           char(32) NOT NULL,
  apstme_d04           datetime NOT NULL,
  acpsta_d04           char(32) NOT NULL,
  acptme_d04           datetime NOT NULL,
  acrtme_d04           datetime NOT NULL,
  axctme_d04           datetime NOT NULL,
  jobnam_d04           char(80) NOT NULL,
  stpnam_d04           char(80) NOT NULL,
  stpmsg_d04           char(240) NOT NULL,
  xrtype_d04           char(1) NOT NULL,
  xr_msg_d04           char(240) NOT NULL,
  sysxml_d04           char(240) NOT NULL,
  PRIMARY KEY (idnd04_d04)
);