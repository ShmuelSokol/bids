-- dbo.kam_tab  (451229 rows)
CREATE TABLE dbo.kam_tab (
  idnkam_kam           int NOT NULL,
  adddte_kam           datetime NOT NULL,
  idnpop_kam           int NOT NULL,
  idnson_kam           int NOT NULL,
  seq_no_kam           int NOT NULL,
  clrnam_kam           char(32) NOT NULL,
  PRIMARY KEY (idnkam_kam)
);