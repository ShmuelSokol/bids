-- dbo.k14_tab  (24 rows)
CREATE TABLE dbo.k14_tab (
  idnk14_k14           int NOT NULL,
  uptime_k14           datetime NOT NULL,
  upname_k14           char(10) NOT NULL,
  idnk12_k14           int NOT NULL,
  u_name_k14           char(10) NOT NULL,
  u_pass_k14           char(20) NOT NULL,
  u_menu_k14           char(20) NOT NULL,
  PRIMARY KEY (idnk14_k14)
);