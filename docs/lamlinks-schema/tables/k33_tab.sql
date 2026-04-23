-- dbo.k33_tab  (46780 rows)
CREATE TABLE dbo.k33_tab (
  idnk33_k33           int NOT NULL,
  uptime_k33           datetime NOT NULL,
  upname_k33           char(10) NOT NULL,
  qotref_k33           char(15) NOT NULL,
  o_stat_k33           char(16) NOT NULL,
  t_stat_k33           char(16) NOT NULL,
  a_stat_k33           char(16) NOT NULL,
  s_stat_k33           char(16) NOT NULL,
  o_stme_k33           datetime NOT NULL,
  t_stme_k33           datetime NOT NULL,
  a_stme_k33           datetime NOT NULL,
  s_stme_k33           datetime NOT NULL,
  itmcnt_k33           int NOT NULL,
  PRIMARY KEY (idnk33_k33)
);