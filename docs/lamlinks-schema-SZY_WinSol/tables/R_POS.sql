-- dbo.R_POS  (3496 rows)
CREATE TABLE dbo.R_POS (
  SUPPLR               char(6) NOT NULL,
  SUPPLRDES            varchar(40),
  ADDRSS1              varchar(40),
  ADDRSS2              varchar(40),
  ADDRSS3              varchar(40),
  TELPHN               varchar(20),
  WATS                 varchar(20),
  FAX                  varchar(20),
  COUNTRY              varchar(4),
  POSTAL               varchar(10),
  PRIMARY KEY (SUPPLR)
);