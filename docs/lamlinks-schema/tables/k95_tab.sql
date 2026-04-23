-- dbo.k95_tab  (262856 rows)
CREATE TABLE dbo.k95_tab (
  idnk95_k95           int NOT NULL,
  addtme_k95           datetime NOT NULL,
  upname_k95           char(10) NOT NULL,
  idnkap_k95           int NOT NULL,
  invk96_k95           int NOT NULL,
  idnka7_k95           int NOT NULL,
  nni_no_k95           int NOT NULL,
  nnides_k95           char(80) NOT NULL,
  nnxref_k95           char(32) NOT NULL,
  nnxdte_k95           datetime NOT NULL,
  effdte_k95           datetime NOT NULL,
  nnista_k95           char(16) NOT NULL,
  nniact_k95           int NOT NULL,
  nnival_k95           numeric(13,2) NOT NULL,
  PRIMARY KEY (idnk95_k95)
);