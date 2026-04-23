-- dbo.kea_tab  (0 rows)
CREATE TABLE dbo.kea_tab (
  idnkea_kea           int NOT NULL,
  adtime_kea           datetime NOT NULL,
  uptime_kea           datetime NOT NULL,
  a_name_kea           char(32) NOT NULL,
  mgtxml_kea           varchar NOT NULL,
  PRIMARY KEY (idnkea_kea)
);