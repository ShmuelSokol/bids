-- dbo.k92_tab  (0 rows)
CREATE TABLE dbo.k92_tab (
  idnk92_k92           int NOT NULL,
  adddte_k92           datetime NOT NULL,
  idnkbh_k92           int NOT NULL,
  idnk71_k92           int NOT NULL,
  idnk91_k92           int NOT NULL,
  rcvqty_k92           numeric(16,5) NOT NULL,
  adjqty_k92           numeric(16,5) NOT NULL,
  snq_12_k92           numeric(16,5) NOT NULL,
  snq_21_k92           numeric(16,5) NOT NULL,
  srq_12_k92           numeric(16,5) NOT NULL,
  soq_12_k92           numeric(16,5) NOT NULL,
  rcvval_k92           numeric(13,2) NOT NULL,
  PRIMARY KEY (idnk92_k92)
);