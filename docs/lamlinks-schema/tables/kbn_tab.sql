-- dbo.kbn_tab  (0 rows)
CREATE TABLE dbo.kbn_tab (
  idnkbn_kbn           int NOT NULL,
  addtme_kbn           datetime NOT NULL,
  addnme_kbn           char(10) NOT NULL,
  idnk12_kbn           int NOT NULL,
  idnkbm_kbn           int NOT NULL,
  cko_no_kbn           int NOT NULL,
  ckonum_kbn           char(32) NOT NULL,
  ckodte_kbn           datetime NOT NULL,
  ckosta_kbn           char(15) NOT NULL,
  ckonte_kbn           char(80) NOT NULL,
  voinme_kbn           char(10) NOT NULL,
  voidte_kbn           datetime NOT NULL,
  wcr_no_kbn           int NOT NULL,
  wcrnum_kbn           char(16) NOT NULL,
  wc1val_kbn           numeric(13,2) NOT NULL,
  wcrval_kbn           numeric(13,2) NOT NULL,
  copval_kbn           numeric(13,2) NOT NULL,
  uocval_kbn           numeric(13,2) NOT NULL,
  wcrcnt_kbn           int NOT NULL,
  PRIMARY KEY (idnkbn_kbn)
);