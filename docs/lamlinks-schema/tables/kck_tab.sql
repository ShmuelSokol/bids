-- dbo.kck_tab  (2 rows)
CREATE TABLE dbo.kck_tab (
  idnkck_kck           int NOT NULL,
  adddte_kck           datetime NOT NULL,
  m_name_kck           char(32) NOT NULL,
  m_titl_kck           char(80) NOT NULL,
  m_desc_kck           varchar(240) NOT NULL,
  PRIMARY KEY (idnkck_kck)
);