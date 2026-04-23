-- dbo.k52_tab  (8 rows)
CREATE TABLE dbo.k52_tab (
  idnk52_k52           int NOT NULL,
  uptime_k52           datetime NOT NULL,
  upname_k52           char(10) NOT NULL,
  idnk51_k52           int NOT NULL,
  idnk21_k52           int NOT NULL,
  rlenam_k52           char(32) NOT NULL,
  rledes_k52           char(80) NOT NULL,
  rleseq_k52           int NOT NULL,
  cricnt_k52           int NOT NULL,
  PRIMARY KEY (idnk52_k52)
);