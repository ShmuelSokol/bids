-- dbo.k88_tab  (0 rows)
CREATE TABLE dbo.k88_tab (
  idnk88_k88           int NOT NULL,
  uptime_k88           datetime NOT NULL,
  upname_k88           char(10) NOT NULL,
  bcttbl_k88           char(3) NOT NULL,
  idnbct_k88           int NOT NULL,
  xc_typ_k88           char(16) NOT NULL,
  xc_cst_k88           numeric(12,4) NOT NULL,
  xc_qty_k88           numeric(16,5) NOT NULL,
  xc_um_k88            char(4) NOT NULL,
  xc_val_k88           numeric(13,2) NOT NULL,
  xc_des_k88           char(80) NOT NULL,
  PRIMARY KEY (idnk88_k88)
);