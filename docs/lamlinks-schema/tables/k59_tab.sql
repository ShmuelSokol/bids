-- dbo.k59_tab  (38 rows)
CREATE TABLE dbo.k59_tab (
  idnk59_k59           int NOT NULL,
  uptime_k59           datetime NOT NULL,
  upname_k59           char(10) NOT NULL,
  lftk12_k59           int NOT NULL,
  rhtk12_k59           int NOT NULL,
  lftpri_k59           int NOT NULL,
  rhtpri_k59           int NOT NULL,
  lrelte_k59           char(40) NOT NULL,
  rrelte_k59           char(40) NOT NULL,
  PRIMARY KEY (idnk59_k59)
);