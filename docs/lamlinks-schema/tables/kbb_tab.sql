-- dbo.kbb_tab  (262855 rows)
CREATE TABLE dbo.kbb_tab (
  idnkbb_kbb           int NOT NULL,
  addtme_kbb           datetime NOT NULL,
  ict_no_kbb           int NOT NULL,
  ictref_kbb           char(24) NOT NULL,
  ictsta_kbb           char(10) NOT NULL,
  statme_kbb           datetime NOT NULL,
  PRIMARY KEY (idnkbb_kbb)
);