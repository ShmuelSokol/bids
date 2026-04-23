-- dbo.k13_tab  (66050 rows)
CREATE TABLE dbo.k13_tab (
  idnk13_k13           int NOT NULL,
  uptime_k13           datetime NOT NULL,
  upname_k13           char(10) NOT NULL,
  idnk12_k13           int NOT NULL,
  cage_k13             char(5) NOT NULL,
  c_name_k13           char(40) NOT NULL,
  PRIMARY KEY (idnk13_k13)
);