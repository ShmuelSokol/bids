-- dbo.k99_tab  (262854 rows)
CREATE TABLE dbo.k99_tab (
  idnk99_k99           int NOT NULL,
  idnk95_k99           int NOT NULL,
  idnk71_k99           int NOT NULL,
  idnka7_k99           int NOT NULL,
  nnlseq_k99           int NOT NULL,
  nnlqty_k99           numeric(16,5) NOT NULL,
  nnlval_k99           numeric(13,2) NOT NULL,
  cnt_no_k99           varchar(30) NOT NULL DEFAULT (''),
  PRIMARY KEY (idnk99_k99)
);