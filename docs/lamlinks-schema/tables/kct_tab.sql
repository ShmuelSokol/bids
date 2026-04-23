-- dbo.kct_tab  (0 rows)
CREATE TABLE dbo.kct_tab (
  idnkct_kct           int NOT NULL,
  adtime_kct           datetime NOT NULL,
  uptime_kct           datetime NOT NULL,
  idnk39_kct           int NOT NULL,
  sradte_kct           datetime NOT NULL,
  sranum_kct           char(16) NOT NULL,
  sraino_kct           char(16) NOT NULL,
  sraval_kct           numeric(13,2) NOT NULL,
  PRIMARY KEY (idnkct_kct)
);