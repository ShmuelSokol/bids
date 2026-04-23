-- dbo.k43_tab  (132 rows)
CREATE TABLE dbo.k43_tab (
  idnk43_k43           int NOT NULL,
  uptime_k43           datetime NOT NULL,
  upname_k43           char(10) NOT NULL,
  idnk40_k43           int NOT NULL,
  idnk42_k43           int NOT NULL,
  itemno_k43           int NOT NULL,
  rqpsta_k43           char(32) NOT NULL,
  rqptme_k43           datetime NOT NULL,
  p_note_k43           text(2147483647) NOT NULL,
  c_note_k43           text(2147483647) NOT NULL,
  PRIMARY KEY (idnk43_k43)
);