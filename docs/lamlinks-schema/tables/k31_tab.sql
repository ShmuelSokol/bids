-- dbo.k31_tab  (483 rows)
CREATE TABLE dbo.k31_tab (
  idnk31_k31           int NOT NULL,
  uptime_k31           datetime NOT NULL,
  upname_k31           char(10) NOT NULL,
  idnk12_k31           int NOT NULL,
  a_code_k31           char(32) NOT NULL,
  c_code_k31           char(32) NOT NULL,
  c_name_k31           char(40) NOT NULL,
  PRIMARY KEY (idnk31_k31)
);