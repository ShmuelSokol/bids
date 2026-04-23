-- dbo.k73_tab  (23 rows)
CREATE TABLE dbo.k73_tab (
  idnk73_k73           int NOT NULL,
  addtme_k73           datetime NOT NULL,
  uptime_k73           datetime NOT NULL,
  upname_k73           char(10) NOT NULL,
  idnk71_k73           int NOT NULL,
  idnk11_k73           int NOT NULL,
  prjnam_k73           char(60) NOT NULL,
  minqty_k73           int NOT NULL,
  midqty_k73           int NOT NULL,
  maxqty_k73           int NOT NULL,
  idnkd2_k73           int NOT NULL DEFAULT ((0)),
  PRIMARY KEY (idnk73_k73)
);