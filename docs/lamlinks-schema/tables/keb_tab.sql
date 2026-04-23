-- dbo.keb_tab  (0 rows)
CREATE TABLE dbo.keb_tab (
  idnkeb_keb           int NOT NULL,
  adtime_keb           datetime NOT NULL,
  idnkdd_keb           int NOT NULL,
  seq_no_keb           int NOT NULL,
  rspxml_keb           varchar(7000) NOT NULL,
  PRIMARY KEY (idnkeb_keb)
);