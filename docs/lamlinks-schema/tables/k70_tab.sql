-- dbo.k70_tab  (72304 rows)
CREATE TABLE dbo.k70_tab (
  idnk70_k70           int NOT NULL,
  adtime_k70           datetime NOT NULL,
  idnk11_k70           int NOT NULL,
  prd_no_k70           int NOT NULL,
  prdesc_k70           char(80) NOT NULL,
  qtylow_k70           int NOT NULL,
  qty_hi_k70           int NOT NULL,
  PRIMARY KEY (idnk70_k70)
);