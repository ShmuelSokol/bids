-- dbo.k55_tab  (117 rows)
CREATE TABLE dbo.k55_tab (
  idnk55_k55           int NOT NULL,
  uptime_k55           datetime NOT NULL,
  upname_k55           char(10) NOT NULL,
  idnk39_k55           int NOT NULL,
  qotdte_k55           datetime NOT NULL,
  qrefno_k55           char(20) NOT NULL,
  q_note_k55           char(254) NOT NULL,
  PRIMARY KEY (idnk55_k55)
);