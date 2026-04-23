-- dbo.k78_tab  (0 rows)
CREATE TABLE dbo.k78_tab (
  idnk78_k78           int NOT NULL,
  addtme_k78           datetime NOT NULL,
  upname_k78           char(10) NOT NULL,
  usecat_k78           varchar(80) NOT NULL,
  m_name_k78           varchar(240) NOT NULL,
  filext_k78           char(10) NOT NULL,
  fildes_k78           varchar(240) NOT NULL,
  bimage_k78           image(2147483647) NOT NULL,
  PRIMARY KEY (idnk78_k78)
);