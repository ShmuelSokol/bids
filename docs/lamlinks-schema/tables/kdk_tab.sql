-- dbo.kdk_tab  (0 rows)
CREATE TABLE dbo.kdk_tab (
  idnkdk_kdk           int NOT NULL,
  adtime_kdk           datetime NOT NULL,
  uptime_kdk           datetime NOT NULL,
  idnk42_kdk           int NOT NULL,
  idnk36_kdk           int NOT NULL,
  rfq_no_kdk           varchar(32) NOT NULL,
  cfznam_kdk           varchar(32) NOT NULL,
  tdpnam_kdk           varchar(32) NOT NULL,
  pdfnam_kdk           varchar(32) NOT NULL,
  xlsnam_kdk           varchar(32) NOT NULL,
  totime_kdk           datetime NOT NULL,
  to_act_kdk           varchar(32) NOT NULL,
  r_stat_kdk           varchar(32) NOT NULL,
  rstime_kdk           datetime NOT NULL,
  rstext_kdk           varchar(240) NOT NULL,
  PRIMARY KEY (idnkdk_kdk)
);