-- dbo.kbj_tab  (1 rows)
CREATE TABLE dbo.kbj_tab (
  idnkbj_kbj           int NOT NULL,
  adddte_kbj           datetime NOT NULL,
  upname_kbj           char(10) NOT NULL,
  mrb_no_kbj           int NOT NULL,
  mrbnum_kbj           char(16) NOT NULL,
  mrbsta_kbj           char(16) NOT NULL,
  mrbtme_kbj           datetime NOT NULL,
  pklcnt_kbj           int NOT NULL,
  PRIMARY KEY (idnkbj_kbj)
);