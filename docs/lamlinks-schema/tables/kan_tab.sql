-- dbo.kan_tab  (642496 rows)
CREATE TABLE dbo.kan_tab (
  idnkan_kan           int NOT NULL,
  adddte_kan           datetime NOT NULL,
  idnkap_kan           int NOT NULL,
  idnkal_kan           int NOT NULL,
  tpltbl_kan           char(3) NOT NULL,
  idntpl_kan           int NOT NULL,
  nodnam_kan           char(80) NOT NULL,
  noddes_kan           char(80) NOT NULL,
  popcnt_kan           int NOT NULL,
  soncnt_kan           int NOT NULL,
  PRIMARY KEY (idnkan_kan)
);