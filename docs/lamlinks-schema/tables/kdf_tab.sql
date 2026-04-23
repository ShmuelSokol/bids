-- dbo.kdf_tab  (4 rows)
CREATE TABLE dbo.kdf_tab (
  idnkdf_kdf           int NOT NULL,
  adtime_kdf           datetime NOT NULL,
  uptime_kdf           datetime NOT NULL,
  athsys_kdf           char(32) NOT NULL,
  athtyp_kdf           varchar(32) NOT NULL,
  lifcyc_kdf           varchar(32) NOT NULL,
  ttl_ms_kdf           int NOT NULL,
  redohh_kdf           int NOT NULL,
  PRIMARY KEY (idnkdf_kdf)
);