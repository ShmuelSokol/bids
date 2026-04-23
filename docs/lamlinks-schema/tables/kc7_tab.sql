-- dbo.kc7_tab  (26 rows)
CREATE TABLE dbo.kc7_tab (
  idnkc7_kc7           int NOT NULL,
  adddte_kc7           datetime NOT NULL,
  addnme_kc7           char(10) NOT NULL,
  idnkc1_kc7           int NOT NULL,
  idnkc2_kc7           int NOT NULL,
  idnkad_kc7           int NOT NULL,
  je_k96_kc7           int NOT NULL,
  seq_no_kc7           int NOT NULL,
  autora_kc7           char(1) NOT NULL,
  pyctyp_kc7           char(40) NOT NULL,
  payval_kc7           numeric(16,2) NOT NULL,
  disval_kc7           numeric(16,2) NOT NULL,
  je_val_kc7           numeric(16,2) NOT NULL,
  depday_kc7           int NOT NULL,
  PRIMARY KEY (idnkc7_kc7)
);