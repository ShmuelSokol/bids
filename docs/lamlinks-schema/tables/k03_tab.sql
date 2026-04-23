-- dbo.k03_tab  (0 rows)
CREATE TABLE dbo.k03_tab (
  idnk03_k03           int NOT NULL,
  adtime_k03           datetime NOT NULL,
  adname_k03           char(10) NOT NULL,
  sttime_k03           datetime NOT NULL,
  status_k03           char(10) NOT NULL,
  inb_no_k03           int NOT NULL,
  inbdes_k03           char(32) NOT NULL,
  invtot_k03           numeric(12,2) NOT NULL,
  invcnt_k03           int NOT NULL,
  sactot_k03           numeric(12,2) NOT NULL,
  PRIMARY KEY (idnk03_k03)
);