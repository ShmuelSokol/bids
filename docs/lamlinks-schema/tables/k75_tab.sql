-- dbo.k75_tab  (0 rows)
CREATE TABLE dbo.k75_tab (
  idnk75_k75           int NOT NULL,
  adddte_k75           datetime NOT NULL,
  dstnam_k75           char(80) NOT NULL,
  dsrtbl_k75           char(3) NOT NULL,
  idndsr_k75           int NOT NULL,
  dsrust_k75           char(32) NOT NULL,
  PRIMARY KEY (idnk75_k75)
);