-- dbo.k16_tab  (95039 rows)
CREATE TABLE dbo.k16_tab (
  idnk16_k16           int NOT NULL,
  uptime_k16           datetime NOT NULL,
  upname_k16           char(10) NOT NULL,
  dwg_no_k16           char(32) NOT NULL,
  docsrc_k16           char(10) NOT NULL,
  ssdtyp_k16           char(4) NOT NULL,
  d_cage_k16           char(5) NOT NULL,
  docdte_k16           datetime NOT NULL,
  titled_k16           char(80) NOT NULL,
  dwgrev_k16           char(3) NOT NULL,
  revdte_k16           datetime NOT NULL,
  doctyp_k16           char(2) NOT NULL,
  avstat_k16           char(20) NOT NULL,
  PRIMARY KEY (idnk16_k16)
);