-- dbo.kd9_tab  (0 rows)
CREATE TABLE dbo.kd9_tab (
  idnkd9_kd9           int NOT NULL,
  adtime_kd9           datetime NOT NULL,
  uptime_kd9           datetime NOT NULL,
  k12ptr_kd9           int NOT NULL,
  k12qto_kd9           int NOT NULL,
  q_stat_kd9           char(32) NOT NULL,
  qppxml_kd9           text(2147483647) NOT NULL,
  PRIMARY KEY (idnkd9_kd9)
);