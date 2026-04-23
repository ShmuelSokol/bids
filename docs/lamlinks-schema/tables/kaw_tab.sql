-- dbo.kaw_tab  (315572 rows)
CREATE TABLE dbo.kaw_tab (
  idnkaw_kaw           int NOT NULL,
  addtme_kaw           datetime NOT NULL,
  idnkba_kaw           int NOT NULL,
  idnout_kaw           int NOT NULL,
  soctbl_kaw           char(3) NOT NULL,
  idnsoc_kaw           int NOT NULL,
  socseq_kaw           int NOT NULL,
  prtcnt_kaw           int NOT NULL,
  subcnt_kaw           int NOT NULL,
  box_wt_kaw           numeric(12,2) NOT NULL,
  cnt_wt_kaw           numeric(12,2) NOT NULL,
  shp_wt_kaw           numeric(12,2) NOT NULL,
  swt_ui_kaw           char(2) NOT NULL,
  shpft3_kaw           numeric(15,3),
  boxtat_kaw           char(10) NOT NULL,
  boxino_kaw           char(10) NOT NULL,
  boxxno_kaw           int NOT NULL,
  pkglen_kaw           int NOT NULL DEFAULT ((0)),
  pkgwth_kaw           int NOT NULL DEFAULT ((0)),
  pkghth_kaw           int NOT NULL DEFAULT ((0)),
  PRIMARY KEY (idnkaw_kaw)
);