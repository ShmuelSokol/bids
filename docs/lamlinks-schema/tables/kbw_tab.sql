-- dbo.kbw_tab  (1 rows)
CREATE TABLE dbo.kbw_tab (
  idnkbw_kbw           int NOT NULL,
  adddte_kbw           datetime NOT NULL,
  upname_kbw           char(10) NOT NULL,
  m1b_no_kbw           int NOT NULL,
  m1bnum_kbw           char(16) NOT NULL,
  m1bsta_kbw           char(16) NOT NULL,
  m1btme_kbw           datetime NOT NULL,
  m1bdes_kbw           char(80) NOT NULL,
  clonme_kbw           char(10) NOT NULL,
  m1cval_kbw           numeric(13,2) NOT NULL,
  m11val_kbw           numeric(13,2) NOT NULL,
  m12val_kbw           numeric(13,2) NOT NULL,
  m1ccnt_kbw           int NOT NULL,
  PRIMARY KEY (idnkbw_kbw)
);