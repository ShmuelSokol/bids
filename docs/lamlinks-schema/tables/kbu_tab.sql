-- dbo.kbu_tab  (0 rows)
CREATE TABLE dbo.kbu_tab (
  idnkbu_kbu           int NOT NULL,
  addtme_kbu           datetime NOT NULL,
  addnme_kbu           char(10) NOT NULL,
  idnkbt_kbu           int NOT NULL,
  idnka4_kbu           int NOT NULL,
  idnwhs_kbu           int NOT NULL,
  locatn_kbu           char(32) NOT NULL,
  ptlseq_kbu           int NOT NULL,
  ptlqty_kbu           numeric(16,5) NOT NULL,
  ptlsta_kbu           char(16) NOT NULL,
  rbytme_kbu           datetime NOT NULL,
  rbunam_kbu           char(10) NOT NULL,
  rsktme_kbu           datetime NOT NULL,
  rsunam_kbu           char(10) NOT NULL,
  PRIMARY KEY (idnkbu_kbu)
);