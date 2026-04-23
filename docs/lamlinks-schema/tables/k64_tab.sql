-- dbo.k64_tab  (1 rows)
CREATE TABLE dbo.k64_tab (
  idnk64_k64           int NOT NULL,
  uptime_k64           datetime NOT NULL,
  upname_k64           char(10) NOT NULL,
  ptcnam_k64           char(32) NOT NULL,
  ptcdes_k64           char(200) NOT NULL,
  PRIMARY KEY (idnk64_k64)
);