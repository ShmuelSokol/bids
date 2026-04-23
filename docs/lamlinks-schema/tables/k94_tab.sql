-- dbo.k94_tab  (823201 rows)
CREATE TABLE dbo.k94_tab (
  idnk94_k94           int NOT NULL,
  adddte_k94           datetime NOT NULL,
  gldcls_k94           char(32) NOT NULL,
  postfl_k94           char(1) NOT NULL,
  pwft1f_k94           char(1) NOT NULL,
  pwft2f_k94           char(1) NOT NULL,
  posdte_k94           datetime NOT NULL,
  revk94_k94           int NOT NULL,
  dbtk96_k94           int NOT NULL,
  crdk96_k94           int NOT NULL,
  ft1tbl_k94           char(3) NOT NULL,
  idnft1_k94           int NOT NULL,
  ft2tbl_k94           char(3) NOT NULL,
  idnft2_k94           int NOT NULL,
  prmtbl_k94           char(3) NOT NULL,
  idnprm_k94           int NOT NULL,
  gl_val_k94           numeric(13,2) NOT NULL,
  gl_des_k94           varchar(240) NOT NULL,
  ortype_k94           char(8) NOT NULL,
  PRIMARY KEY (idnk94_k94)
);