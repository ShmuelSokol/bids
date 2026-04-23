-- dbo.k46_tab  (0 rows)
CREATE TABLE dbo.k46_tab (
  idnk46_k46           int NOT NULL,
  uptime_k46           datetime NOT NULL,
  upname_k46           char(10) NOT NULL,
  ccttyp_k46           char(3) NOT NULL,
  idncct_k46           int NOT NULL,
  c_type_k46           char(20) NOT NULL,
  msgtyp_k46           char(20) NOT NULL,
  ctitle_k46           char(60) NOT NULL,
  ourpoc_k46           char(60) NOT NULL,
  thrnam_k46           char(60) NOT NULL,
  thrpoc_k46           char(60) NOT NULL,
  cclsta_k46           char(16) NOT NULL,
  ccltme_k46           datetime NOT NULL,
  deltme_k46           datetime NOT NULL,
  PRIMARY KEY (idnk46_k46)
);