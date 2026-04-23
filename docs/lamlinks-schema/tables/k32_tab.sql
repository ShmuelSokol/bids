-- dbo.k32_tab  (2235789 rows)
CREATE TABLE dbo.k32_tab (
  idnk32_k32           int NOT NULL,
  uptime_k32           datetime NOT NULL,
  upname_k32           char(10) NOT NULL,
  idnk11_k32           int NOT NULL,
  shptol_k32           char(80) NOT NULL,
  qty_k32              int NOT NULL,
  dlydte_k32           datetime NOT NULL,
  itemno_k32           char(10) NOT NULL,
  PRIMARY KEY (idnk32_k32)
);