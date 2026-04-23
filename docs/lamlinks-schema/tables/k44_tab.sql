-- dbo.k44_tab  (132 rows)
CREATE TABLE dbo.k44_tab (
  idnk44_k44           int NOT NULL,
  uptime_k44           datetime NOT NULL,
  upname_k44           char(10) NOT NULL,
  idnk43_k44           int NOT NULL,
  vrqqty_k44           int NOT NULL,
  vrqaro_k44           int NOT NULL,
  vrqdly_k44           datetime NOT NULL,
  PRIMARY KEY (idnk44_k44)
);