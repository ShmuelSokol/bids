-- dbo.k38_tab  (159 rows)
CREATE TABLE dbo.k38_tab (
  idnk38_k38           int NOT NULL,
  uptime_k38           datetime NOT NULL,
  upname_k38           char(10) NOT NULL,
  idnk37_k38           int NOT NULL,
  vrqqty_k38           int NOT NULL,
  vrqaro_k38           int NOT NULL,
  vrqdly_k38           datetime NOT NULL,
  PRIMARY KEY (idnk38_k38)
);