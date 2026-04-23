-- dbo.kcs_tab  (0 rows)
CREATE TABLE dbo.kcs_tab (
  idnkcs_kcs           int NOT NULL,
  adtime_kcs           datetime NOT NULL,
  uptime_kcs           datetime NOT NULL,
  idnkcr_kcs           int NOT NULL,
  idnkcw_kcs           int NOT NULL,
  idnkct_kcs           int NOT NULL,
  dbstbl_kcs           char(3) NOT NULL,
  idndbs_kcs           int NOT NULL,
  dml_no_kcs           int NOT NULL,
  srmano_kcs           varchar(32) NOT NULL,
  dmldes_kcs           varchar(120) NOT NULL,
  matdsp_kcs           varchar(32) NOT NULL,
  dmlqty_kcs           int NOT NULL,
  dml_up_kcs           numeric(13,4) NOT NULL,
  dml_ui_kcs           char(2) NOT NULL,
  invval_kcs           numeric(13,2) NOT NULL,
  nmaval_kcs           numeric(13,2) NOT NULL,
  dmlval_kcs           numeric(13,2) NOT NULL,
  dmlxml_kcs           text(2147483647) NOT NULL,
  PRIMARY KEY (idnkcs_kcs)
);