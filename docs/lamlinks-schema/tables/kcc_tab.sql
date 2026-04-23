-- dbo.kcc_tab  (0 rows)
CREATE TABLE dbo.kcc_tab (
  idnkcc_kcc           int NOT NULL,
  addtme_kcc           datetime NOT NULL,
  addnme_kcc           char(10) NOT NULL,
  tesk14_kcc           int NOT NULL,
  srctbl_kcc           char(3) NOT NULL,
  idnsrc_kcc           int NOT NULL,
  e_type_kcc           char(1) NOT NULL,
  tetime_kcc           datetime NOT NULL,
  tedesc_kcc           text(2147483647) NOT NULL,
  PRIMARY KEY (idnkcc_kcc)
);