-- dbo.kah_tab  (285323 rows)
CREATE TABLE dbo.kah_tab (
  idnkah_kah           int NOT NULL,
  uptime_kah           datetime NOT NULL,
  upname_kah           char(10) NOT NULL,
  anutbl_kah           char(3) NOT NULL,
  idnanu_kah           int NOT NULL,
  anutyp_kah           char(48) NOT NULL,
  a_note_kah           text(2147483647) NOT NULL,
  PRIMARY KEY (idnkah_kah)
);