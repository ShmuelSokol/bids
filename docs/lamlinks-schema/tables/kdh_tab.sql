-- dbo.kdh_tab  (0 rows)
CREATE TABLE dbo.kdh_tab (
  idnkdh_kdh           int NOT NULL,
  adtime_kdh           datetime NOT NULL,
  uptime_kdh           datetime NOT NULL,
  idnk12_kdh           int NOT NULL,
  idnk06_kdh           int NOT NULL,
  q_mode_kdh           char(32) NOT NULL,
  PRIMARY KEY (idnkdh_kdh)
);