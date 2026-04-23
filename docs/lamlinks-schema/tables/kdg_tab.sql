-- dbo.kdg_tab  (1 rows)
CREATE TABLE dbo.kdg_tab (
  idnkdg_kdg           int NOT NULL,
  adtime_kdg           datetime NOT NULL,
  efftme_kdg           datetime NOT NULL,
  idnkdf_kdg           int NOT NULL,
  tbltoa_kdg           char(3) NOT NULL,
  idntoa_kdg           int NOT NULL,
  toanam_kdg           varchar(80) NOT NULL,
  c_stat_kdg           varchar(32) NOT NULL,
  c_text_kdg           varchar(160) NOT NULL,
  athxml_kdg           varchar NOT NULL,
  PRIMARY KEY (idnkdg_kdg)
);