-- dbo.k21_tab  (11 rows)
CREATE TABLE dbo.k21_tab (
  idnk21_k21           int NOT NULL,
  uptime_k21           datetime NOT NULL,
  upname_k21           char(10) NOT NULL,
  slcnam_k21           char(32) NOT NULL,
  slcdes_k21           char(80) NOT NULL,
  slcsys_k21           char(3) NOT NULL,
  checkd_k21           char(1) NOT NULL,
  idnk22_k21           int NOT NULL,
  idnk24_k21           int NOT NULL,
  idnk14_k21           int NOT NULL,
  idnk25_k21           int NOT NULL,
  idnk36_k21           int NOT NULL,
  PRIMARY KEY (idnk21_k21)
);