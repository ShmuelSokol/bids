-- dbo.kbx_tab  (0 rows)
CREATE TABLE dbo.kbx_tab (
  idnkbx_kbx           int NOT NULL,
  addtme_kbx           datetime NOT NULL,
  addnme_kbx           char(10) NOT NULL,
  idnk12_kbx           int NOT NULL,
  idnkbw_kbx           int NOT NULL,
  m2atmd_kbx           char(32) NOT NULL,
  m2anum_kbx           char(32) NOT NULL,
  m2adte_kbx           datetime NOT NULL,
  m2asta_kbx           char(15) NOT NULL,
  m22val_kbx           numeric(13,2) NOT NULL,
  m2ante_kbx           char(80) NOT NULL,
  m2r_no_kbx           int NOT NULL,
  m2rnum_kbx           char(16) NOT NULL,
  m2rval_kbx           numeric(13,2) NOT NULL,
  m21val_kbx           numeric(13,2) NOT NULL,
  cipval_kbx           numeric(13,2) NOT NULL,
  uorval_kbx           numeric(13,2) NOT NULL,
  m2rcnt_kbx           int NOT NULL,
  PRIMARY KEY (idnkbx_kbx)
);