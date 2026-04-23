-- dbo.kdb_tab  (0 rows)
CREATE TABLE dbo.kdb_tab (
  idnkdb_kdb           int NOT NULL,
  adtime_kdb           datetime NOT NULL,
  idnkd8_kdb           int NOT NULL,
  t_clas_kdb           char(32) NOT NULL,
  t_time_kdb           datetime NOT NULL,
  t_stat_kdb           varchar(32) NOT NULL,
  t_comp_kdb           varchar(32) NOT NULL,
  t_text_kdb           varchar(240) NOT NULL,
  PRIMARY KEY (idnkdb_kdb)
);