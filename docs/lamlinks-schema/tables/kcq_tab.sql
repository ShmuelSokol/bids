-- dbo.kcq_tab  (0 rows)
CREATE TABLE dbo.kcq_tab (
  idnkcq_kcq           int NOT NULL,
  adtime_kcq           datetime NOT NULL,
  uptime_kcq           datetime NOT NULL,
  idnkcp_kcq           int NOT NULL,
  idnk71_kcq           int NOT NULL,
  qal_no_kcq           int NOT NULL,
  dc1tab_kcq           char(3) NOT NULL,
  idndc1_kcq           int NOT NULL,
  dc2tab_kcq           char(3) NOT NULL,
  idndc2_kcq           int NOT NULL,
  ibyk14_kcq           int NOT NULL,
  abyk14_kcq           int NOT NULL,
  qastat_kcq           varchar(20) NOT NULL,
  qalxml_kcq           text(2147483647) NOT NULL,
  PRIMARY KEY (idnkcq_kcq)
);