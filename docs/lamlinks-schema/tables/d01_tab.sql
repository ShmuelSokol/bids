-- dbo.d01_tab  (17 rows)
CREATE TABLE dbo.d01_tab (
  idnd01_d01           int NOT NULL,
  addtme_d01           datetime NOT NULL,
  addnme_d01           char(10) NOT NULL,
  nodeid_d01           char(32) NOT NULL,
  nodesc_d01           char(40) NOT NULL,
  PRIMARY KEY (idnd01_d01)
);