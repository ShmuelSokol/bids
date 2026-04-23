-- dbo.kbg_tab  (1 rows)
CREATE TABLE dbo.kbg_tab (
  idnkbg_kbg           int NOT NULL,
  adddte_kbg           datetime NOT NULL,
  upname_kbg           char(10) NOT NULL,
  idnk12_kbg           int NOT NULL,
  stg_no_kbg           int NOT NULL,
  stgnum_kbg           char(16) NOT NULL,
  stgsta_kbg           char(16) NOT NULL,
  stgtme_kbg           datetime NOT NULL,
  PRIMARY KEY (idnkbg_kbg)
);