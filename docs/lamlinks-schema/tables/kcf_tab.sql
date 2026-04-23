-- dbo.kcf_tab  (1 rows)
CREATE TABLE dbo.kcf_tab (
  idnkcf_kcf           int NOT NULL,
  addtme_kcf           datetime NOT NULL,
  addnme_kcf           char(10) NOT NULL,
  idnkcb_kcf           int NOT NULL,
  seq_no_kcf           int NOT NULL,
  PRIMARY KEY (idnkcf_kcf)
);