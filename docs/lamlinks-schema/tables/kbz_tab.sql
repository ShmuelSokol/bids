-- dbo.kbz_tab  (0 rows)
CREATE TABLE dbo.kbz_tab (
  idnkbz_kbz           int NOT NULL,
  uptime_kbz           datetime NOT NULL,
  upname_kbz           char(10) NOT NULL,
  je1_no_kbz           int NOT NULL,
  je1num_kbz           char(16) NOT NULL,
  je1sta_kbz           char(16) NOT NULL,
  je1tme_kbz           datetime NOT NULL,
  je1des_kbz           char(80) NOT NULL,
  jepnme_kbz           char(10) NOT NULL,
  jevnme_kbz           char(10) NOT NULL,
  je1val_kbz           numeric(13,2) NOT NULL,
  PRIMARY KEY (idnkbz_kbz)
);