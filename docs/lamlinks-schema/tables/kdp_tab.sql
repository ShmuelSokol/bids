-- dbo.kdp_tab  (0 rows)
CREATE TABLE dbo.kdp_tab (
  idnkdp_kdp           int NOT NULL,
  adtime_kdp           datetime NOT NULL,
  uptime_kdp           datetime NOT NULL,
  qrname_kdp           varchar(50) NOT NULL,
  qrutyp_kdp           varchar(12) NOT NULL,
  q_desc_kdp           varchar(100) NOT NULL,
  q_text_kdp           varchar NOT NULL,
  PRIMARY KEY (idnkdp_kdp)
);