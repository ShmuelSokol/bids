-- dbo.def_insh  (0 rows)
CREATE TABLE dbo.def_insh (
  INVOICE              varchar(7) NOT NULL,
  SHIPTONAM            varchar(30) NOT NULL,
  ADDR1                varchar(30) NOT NULL,
  ADDR2                varchar(30) NOT NULL,
  ADDR3                varchar(30) NOT NULL,
  POSTAL               varchar(10) NOT NULL,
  PROVNC               varchar(2) NOT NULL,
  COUNTR               varchar(20) NOT NULL
);