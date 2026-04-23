-- dbo.kbm_tab  (1 rows)
CREATE TABLE dbo.kbm_tab (
  idnkbm_kbm           int NOT NULL,
  adddte_kbm           datetime NOT NULL,
  upname_kbm           char(10) NOT NULL,
  cwb_no_kbm           int NOT NULL,
  cwbnum_kbm           char(16) NOT NULL,
  cwbsta_kbm           char(16) NOT NULL,
  cwbtme_kbm           datetime NOT NULL,
  cwbdes_kbm           char(80) NOT NULL,
  clonme_kbm           char(10) NOT NULL,
  prtnme_kbm           char(10) NOT NULL,
  cwcval_kbm           numeric(13,2) NOT NULL,
  cw1val_kbm           numeric(13,2) NOT NULL,
  cwccnt_kbm           int NOT NULL,
  PRIMARY KEY (idnkbm_kbm)
);