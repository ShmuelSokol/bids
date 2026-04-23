-- dbo.k23_tab  (2 rows)
CREATE TABLE dbo.k23_tab (
  idnk23_k23           int NOT NULL,
  uptime_k23           datetime NOT NULL,
  upname_k23           char(10) NOT NULL,
  sacnam_k23           char(32) NOT NULL,
  sacdes_k23           char(80) NOT NULL,
  sactyp_k23           char(16) NOT NULL,
  sacsys_k23           char(3) NOT NULL,
  retday_k23           int NOT NULL,
  totday_k23           int NOT NULL,
  daybas_k23           char(24) NOT NULL,
  seq_no_k23           numeric(6,4) NOT NULL,
  PRIMARY KEY (idnk23_k23)
);