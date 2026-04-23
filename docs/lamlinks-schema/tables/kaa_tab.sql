-- dbo.kaa_tab  (150414 rows)
CREATE TABLE dbo.kaa_tab (
  idnkaa_kaa           int NOT NULL,
  adddte_kaa           datetime NOT NULL,
  netdte_kaa           datetime NOT NULL,
  idnka8_kaa           int NOT NULL,
  idnk71_kaa           int NOT NULL,
  sop_um_kaa           char(2) NOT NULL,
  qfactr_kaa           numeric(13,6) NOT NULL,
  cnq_11_kaa           int NOT NULL,
  mkq_11_kaa           numeric(16,5) NOT NULL,
  rnq_11_kaa           numeric(16,5) NOT NULL,
  roq_11_kaa           numeric(16,5) NOT NULL,
  snq_15_kaa           numeric(16,5) NOT NULL,
  soq_15_kaa           numeric(16,5) NOT NULL,
  PRIMARY KEY (idnkaa_kaa)
);