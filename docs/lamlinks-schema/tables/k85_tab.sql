-- dbo.k85_tab  (274667 rows)
CREATE TABLE dbo.k85_tab (
  idnk85_k85           int NOT NULL,
  adddte_k85           datetime NOT NULL,
  netdte_k85           datetime NOT NULL,
  idnk81_k85           int NOT NULL,
  idnk84_k85           int NOT NULL,
  dlydte_k85           datetime NOT NULL,
  cnq_01_k85           int NOT NULL,
  mkq_01_k85           numeric(16,5) NOT NULL,
  rnq_01_k85           numeric(16,5) NOT NULL,
  rsx_01_k85           numeric(16,5) NOT NULL,
  rlq_01_k85           numeric(16,5) NOT NULL,
  rrq_01_k85           numeric(16,5) NOT NULL,
  roq_01_k85           numeric(16,5) NOT NULL,
  snq_01_k85           numeric(16,5) NOT NULL,
  rsvqty_k85           numeric(16,5) NOT NULL,
  rsoqty_k85           numeric(16,5) NOT NULL,
  PRIMARY KEY (idnk85_k85)
);