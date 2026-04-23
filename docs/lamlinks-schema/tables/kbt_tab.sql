-- dbo.kbt_tab  (0 rows)
CREATE TABLE dbo.kbt_tab (
  idnkbt_kbt           int NOT NULL,
  addtme_kbt           datetime NOT NULL,
  addnme_kbt           char(10) NOT NULL,
  pkt_no_kbt           int NOT NULL,
  pktnum_kbt           char(16) NOT NULL,
  ptunam_kbt           char(10) NOT NULL,
  ptutme_kbt           datetime NOT NULL,
  pktsta_kbt           char(16) NOT NULL,
  statme_kbt           datetime NOT NULL,
  pktcnt_kbt           int NOT NULL,
  PRIMARY KEY (idnkbt_kbt)
);