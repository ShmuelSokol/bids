-- dbo.k58_tab  (54 rows)
CREATE TABLE dbo.k58_tab (
  idnk58_k58           int NOT NULL,
  uptime_k58           datetime NOT NULL,
  upname_k58           char(10) NOT NULL,
  idnk57_k58           int NOT NULL,
  xc_typ_k58           char(4) NOT NULL,
  xc_cst_k58           numeric(12,4) NOT NULL,
  xc_des_k58           char(60) NOT NULL,
  PRIMARY KEY (idnk58_k58)
);