-- dbo.k68_tab  (0 rows)
CREATE TABLE dbo.k68_tab (
  idnk68_k68           int NOT NULL,
  uptime_k68           datetime NOT NULL,
  upname_k68           char(10) NOT NULL,
  sn_num_k68           int NOT NULL,
  sntitl_k68           char(80) NOT NULL,
  sndesc_k68           char(80) NOT NULL,
  snnote_k68           text(2147483647) NOT NULL,
  PRIMARY KEY (idnk68_k68)
);