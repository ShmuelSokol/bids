-- dbo.k18_tab  (218775 rows)
CREATE TABLE dbo.k18_tab (
  idnk18_k18           int NOT NULL,
  uptime_k18           datetime NOT NULL,
  upname_k18           char(10) NOT NULL,
  idnk16_k18           int NOT NULL,
  dgutyp_k18           char(3) NOT NULL,
  idndgu_k18           int NOT NULL,
  ty_no_k18            char(32) NOT NULL,
  tdpsrc_k18           char(1) NOT NULL,
  ctdsrc_k18           char(1) NOT NULL,
  PRIMARY KEY (idnk18_k18)
);