-- dbo.k48_tab  (0 rows)
CREATE TABLE dbo.k48_tab (
  idnk48_k48           int NOT NULL,
  uptime_k48           datetime NOT NULL,
  upname_k48           char(10) NOT NULL,
  idnk47_k48           int NOT NULL,
  delenc_k48           char(1) NOT NULL,
  encnam_k48           char(120) NOT NULL,
  encdta_k48           char(15) NOT NULL,
  apttyp_k48           char(3) NOT NULL,
  idnapt_k48           int NOT NULL,
  PRIMARY KEY (idnk48_k48)
);