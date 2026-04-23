-- dbo.kc2_tab  (199047 rows)
CREATE TABLE dbo.kc2_tab (
  idnkc2_kc2           int NOT NULL,
  adddte_kc2           datetime NOT NULL,
  addnme_kc2           char(10) NOT NULL,
  idnkc1_kc2           int NOT NULL,
  seq_no_kc2           int NOT NULL,
  pybsta_kc2           char(32) NOT NULL,
  pybmsg_kc2           varchar(80) NOT NULL,
  pybtme_kc2           datetime NOT NULL,
  rmr01_kc2            char(2) NOT NULL,
  rmr02_kc2            char(30) NOT NULL,
  rmr03_kc2            char(2) NOT NULL,
  rmr04_kc2            numeric(16,2) NOT NULL,
  rmr05_kc2            numeric(16,2) NOT NULL,
  rmr06_kc2            numeric(16,2) NOT NULL,
  invdte_kc2           datetime NOT NULL,
  PRIMARY KEY (idnkc2_kc2)
);