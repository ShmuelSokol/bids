-- dbo.kbc_tab  (200538 rows)
CREATE TABLE dbo.kbc_tab (
  idnkbc_kbc           int NOT NULL,
  idnk93_kbc           int NOT NULL,
  idnwhs_kbc           int NOT NULL,
  locdte_kbc           datetime NOT NULL,
  locatn_kbc           char(32) NOT NULL,
  locqty_kbc           numeric(16,5) NOT NULL,
  locmas_kbc           varchar(32) NOT NULL DEFAULT (''),
  PRIMARY KEY (idnkbc_kbc)
);