-- dbo.k84_tab  (162243 rows)
CREATE TABLE dbo.k84_tab (
  idnk84_k84           int NOT NULL,
  adddte_k84           datetime NOT NULL,
  netdte_k84           datetime NOT NULL,
  idnk79_k84           int NOT NULL,
  idnk71_k84           int NOT NULL,
  sop_um_k84           char(2) NOT NULL,
  qfactr_k84           numeric(13,6) NOT NULL,
  cnq_01_k84           int NOT NULL,
  mkq_01_k84           numeric(16,5) NOT NULL,
  rnq_01_k84           numeric(16,5) NOT NULL,
  roq_01_k84           numeric(16,5) NOT NULL,
  snq_01_k84           numeric(16,5) NOT NULL,
  slq_01_k84           numeric(16,5) NOT NULL,
  srq_01_k84           numeric(16,5) NOT NULL,
  soq_01_k84           numeric(16,5) NOT NULL,
  PRIMARY KEY (idnk84_k84)
);