-- dbo.k40_tab  (124 rows)
CREATE TABLE dbo.k40_tab (
  idnk40_k40           int NOT NULL,
  uptime_k40           datetime NOT NULL,
  upname_k40           char(10) NOT NULL,
  idnk08_k40           int NOT NULL,
  idnk39_k40           int NOT NULL,
  spnnum_k40           char(32) NOT NULL,
  rfqpok_k40           char(1) NOT NULL,
  p_note_k40           text(2147483647) NOT NULL,
  spncge_k40           char(5) NOT NULL,
  enauto_k40           char(1) NOT NULL,
  PRIMARY KEY (idnk40_k40)
);