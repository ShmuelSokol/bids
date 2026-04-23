-- dbo.kec_tab  (0 rows)
CREATE TABLE dbo.kec_tab (
  idnkec_kec           int NOT NULL,
  adtime_kec           datetime NOT NULL,
  uptime_kec           datetime NOT NULL,
  fartyp_kec           char(16) NOT NULL,
  farcls_kec           char(32) NOT NULL,
  farttl_kec           varchar(230) NOT NULL,
  PRIMARY KEY (idnkec_kec)
);