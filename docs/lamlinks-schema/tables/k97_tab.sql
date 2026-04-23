-- dbo.k97_tab  (5 rows)
CREATE TABLE dbo.k97_tab (
  idnk97_k97           int NOT NULL,
  adddte_k97           datetime NOT NULL,
  gl_grp_k97           char(80) NOT NULL,
  gl_cat_k97           char(32) NOT NULL,
  gl_utp_k97           char(16) NOT NULL,
  gl_sgt_k97           char(80) NOT NULL,
  gl_blc_k97           char(20) NOT NULL,
  PRIMARY KEY (idnk97_k97)
);