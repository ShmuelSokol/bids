-- dbo.k56_tab  (117 rows)
CREATE TABLE dbo.k56_tab (
  idnk56_k56           int NOT NULL,
  uptime_k56           datetime NOT NULL,
  upname_k56           char(10) NOT NULL,
  idnk43_k56           int NOT NULL,
  idnk55_k56           int NOT NULL,
  q_type_k56           char(10) NOT NULL,
  p_um_k56             char(2) NOT NULL,
  qfactr_k56           numeric(13,6) NOT NULL,
  p_cage_k56           char(5) NOT NULL,
  partno_k56           char(32) NOT NULL,
  su_lbs_k56           numeric(9,2) NOT NULL,
  p_note_k56           char(254) NOT NULL,
  PRIMARY KEY (idnk56_k56)
);