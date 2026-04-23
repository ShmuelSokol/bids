-- dbo.def_sush  (0 rows)
CREATE TABLE dbo.def_sush (
  CUSTMR               varchar(7) NOT NULL,
  SHIPTO               varchar(6) NOT NULL,
  SHIPTONAM            varchar(30) NOT NULL,
  ADDR1                varchar(30) NOT NULL,
  ADDR2                varchar(30) NOT NULL,
  ADDR3                varchar(30) NOT NULL,
  POSTAL               varchar(10) NOT NULL,
  TAXGRO               varchar(8) NOT NULL,
  SALREP               varchar(2) NOT NULL,
  TELPHN               varchar(15) NOT NULL,
  PROVNC               varchar(2) NOT NULL,
  COUNTR               varchar(20) NOT NULL,
  ZONE                 varchar(8) NOT NULL
);