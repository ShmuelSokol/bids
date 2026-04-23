-- dbo.kau_tab  (1963 rows)
CREATE TABLE dbo.kau_tab (
  idnkau_kau           int NOT NULL,
  adddte_kau           datetime NOT NULL,
  idnkap_kau           int NOT NULL,
  gx1tbl_kau           char(3) NOT NULL,
  idngx1_kau           int NOT NULL,
  gx2tbl_kau           char(3) NOT NULL,
  idngx2_kau           int NOT NULL,
  PRIMARY KEY (idnkau_kau)
);