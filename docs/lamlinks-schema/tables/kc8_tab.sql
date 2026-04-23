-- dbo.kc8_tab  (0 rows)
CREATE TABLE dbo.kc8_tab (
  idnkc8_kc8           int NOT NULL,
  uptime_kc8           datetime NOT NULL,
  upname_kc8           char(10) NOT NULL,
  idnkc6_kc8           int NOT NULL,
  idnwhs_kc8           int NOT NULL,
  drstbl_kc8           char(3) NOT NULL,
  idndrs_kc8           int NOT NULL,
  locatn_kc8           char(32) NOT NULL,
  mdl_no_kc8           int NOT NULL,
  mdldes_kc8           varchar(240) NOT NULL,
  srr_12_kc8           numeric(16,5) NOT NULL,
  mdlqty_kc8           int NOT NULL,
  mdl_up_kc8           numeric(13,4) NOT NULL,
  mdl_ui_kc8           char(2) NOT NULL,
  invval_kc8           numeric(13,2) NOT NULL,
  PRIMARY KEY (idnkc8_kc8)
);