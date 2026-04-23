-- dbo.k96_tab  (34 rows)
CREATE TABLE dbo.k96_tab (
  idnk96_k96           int NOT NULL,
  adddte_k96           datetime NOT NULL,
  idnk97_k96           int NOT NULL,
  gl_nam_k96           char(80) NOT NULL,
  gl_num_k96           char(16) NOT NULL,
  gl_cat_k96           char(32) NOT NULL,
  gl_utp_k96           char(16) NOT NULL,
  gl_stp_k96           char(80) NOT NULL,
  fdtcnt_k96           int NOT NULL,
  gl_dpv_k96           numeric(13,2) NOT NULL,
  gl_dnv_k96           numeric(13,2) NOT NULL,
  gl_cpv_k96           numeric(13,2) NOT NULL,
  gl_cnv_k96           numeric(13,2) NOT NULL,
  PRIMARY KEY (idnk96_k96)
);