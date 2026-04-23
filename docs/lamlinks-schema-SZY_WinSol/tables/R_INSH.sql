-- dbo.R_INSH  (235509 rows)
CREATE TABLE dbo.R_INSH (
  INVOICE              char(7) NOT NULL,
  SHIPTONAM            varchar(30),
  ADDR1                varchar(30),
  ADDR2                varchar(30),
  ADDR3                varchar(30),
  POSTAL               varchar(10),
  PROVNC               char(2),
  COUNTR               varchar(20),
  PRIMARY KEY (INVOICE)
);