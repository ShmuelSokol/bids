-- dbo.k50_tab  (0 rows)
CREATE TABLE dbo.k50_tab (
  idnk50_k50           int NOT NULL,
  uptime_k50           datetime NOT NULL,
  upname_k50           char(10) NOT NULL,
  idnk49_k50           int NOT NULL,
  fxpnam_k50           char(15) NOT NULL,
  apttyp_k50           char(3) NOT NULL,
  idnapt_k50           int NOT NULL,
  PRIMARY KEY (idnk50_k50)
);