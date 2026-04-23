-- dbo.kbr_tab  (514210 rows)
CREATE TABLE dbo.kbr_tab (
  idnkbr_kbr           int NOT NULL,
  addtme_kbr           datetime NOT NULL,
  addnme_kbr           char(10) NOT NULL,
  itttbl_kbr           char(3) NOT NULL,
  idnitt_kbr           int NOT NULL,
  idnkap_kbr           int NOT NULL,
  xtcscn_kbr           char(32) NOT NULL,
  xtcsta_kbr           char(64) NOT NULL,
  xtctme_kbr           datetime NOT NULL,
  PRIMARY KEY (idnkbr_kbr)
);