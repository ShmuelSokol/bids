-- dbo.kax_tab  (319147 rows)
CREATE TABLE dbo.kax_tab (
  idnkax_kax           int NOT NULL,
  adddte_kax           datetime NOT NULL,
  idnkaw_kax           int NOT NULL,
  bxptbl_kax           char(3) NOT NULL,
  idnbxp_kax           int NOT NULL,
  prtcnt_kax           int NOT NULL,
  PRIMARY KEY (idnkax_kax)
);