-- dbo.k63_tab  (1099985 rows)
CREATE TABLE dbo.k63_tab (
  idnk63_k63           int NOT NULL,
  uptime_k63           datetime NOT NULL,
  upname_k63           char(10) NOT NULL,
  efftme_k63           datetime NOT NULL,
  idnk62_k63           int NOT NULL,
  idnk34_k63           int NOT NULL,
  c_code_k63           int NOT NULL,
  c_text_k63           varchar(240) NOT NULL,
  c_note_k63           text(2147483647),
  PRIMARY KEY (idnk63_k63)
);