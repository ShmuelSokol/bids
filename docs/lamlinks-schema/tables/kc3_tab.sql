-- dbo.kc3_tab  (753 rows)
CREATE TABLE dbo.kc3_tab (
  idnkc3_kc3           int NOT NULL,
  addtme_kc3           datetime NOT NULL,
  addnme_kc3           char(10) NOT NULL,
  dod_um_kc3           char(2) NOT NULL,
  x12_um_kc3           char(2) NOT NULL,
  umdesc_kc3           char(80) NOT NULL,
  PRIMARY KEY (idnkc3_kc3)
);