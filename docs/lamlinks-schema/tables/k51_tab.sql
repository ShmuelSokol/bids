-- dbo.k51_tab  (3 rows)
CREATE TABLE dbo.k51_tab (
  idnk51_k51           int NOT NULL,
  uptime_k51           datetime NOT NULL,
  upname_k51           char(10) NOT NULL,
  idnk21_k51           int NOT NULL,
  flrtyp_k51           char(16) NOT NULL,
  flrnam_k51           char(32) NOT NULL,
  flrdes_k51           char(80) NOT NULL,
  PRIMARY KEY (idnk51_k51)
);