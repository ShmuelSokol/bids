-- dbo.kab_tab  (263140 rows)
CREATE TABLE dbo.kab_tab (
  idnkab_kab           int NOT NULL,
  adddte_kab           datetime NOT NULL,
  netdte_kab           datetime NOT NULL,
  idnka9_kab           int NOT NULL,
  idnkaa_kab           int NOT NULL,
  idnk85_kab           int NOT NULL,
  cnq_11_kab           int NOT NULL,
  mkq_11_kab           numeric(16,5) NOT NULL,
  rnq_11_kab           numeric(16,5) NOT NULL,
  rlq_11_kab           numeric(16,5) NOT NULL,
  rcq_11_kab           numeric(16,5) NOT NULL,
  rrq_11_kab           numeric(16,5) NOT NULL,
  roq_11_kab           numeric(16,5) NOT NULL,
  snq_15_kab           numeric(16,5) NOT NULL,
  slq_15_kab           numeric(16,5) NOT NULL,
  srq_15_kab           numeric(16,5) NOT NULL,
  soq_15_kab           numeric(16,5) NOT NULL,
  pinval_kab           numeric(13,2) NOT NULL,
  potval_kab           numeric(13,2) NOT NULL,
  PRIMARY KEY (idnkab_kab)
);