-- dbo.kdm_tab  (0 rows)
CREATE TABLE dbo.kdm_tab (
  idnkdm_kdm           int NOT NULL,
  adtime_kdm           datetime NOT NULL,
  uptime_kdm           datetime NOT NULL,
  idnkdk_kdm           int NOT NULL,
  took12_kdm           int NOT NULL,
  toopoc_kdm           varchar(80) NOT NULL,
  tooeml_kdm           varchar(80) NOT NULL,
  srfqno_kdm           varchar(64) NOT NULL,
  bdytyp_kdm           varchar(16) NOT NULL,
  t_clas_kdm           varchar(12) NOT NULL,
  r_stat_kdm           varchar(32) NOT NULL,
  rstime_kdm           datetime NOT NULL,
  rstext_kdm           varchar(240) NOT NULL,
  PRIMARY KEY (idnkdm_kdm)
);