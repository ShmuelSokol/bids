-- dbo.kcj_tab  (10 rows)
CREATE TABLE dbo.kcj_tab (
  idnkcj_kcj           int NOT NULL,
  adddte_kcj           datetime NOT NULL,
  c_clas_kcj           char(80) NOT NULL,
  c_name_kcj           char(80) NOT NULL,
  cuname_kcj           char(80) NOT NULL,
  c_desc_kcj           varchar(240) NOT NULL,
  c_unit_kcj           char(16) NOT NULL,
  PRIMARY KEY (idnkcj_kcj)
);