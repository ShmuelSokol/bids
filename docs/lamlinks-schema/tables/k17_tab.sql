-- dbo.k17_tab  (0 rows)
CREATE TABLE dbo.k17_tab (
  idnk17_k17           int NOT NULL,
  uptime_k17           datetime NOT NULL,
  upname_k17           char(10) NOT NULL,
  frame_k17            char(4) NOT NULL,
  sheet_k17            char(4) NOT NULL,
  fillen_k17           int NOT NULL,
  filnam_k17           char(15) NOT NULL,
  PRIMARY KEY (idnk17_k17)
);