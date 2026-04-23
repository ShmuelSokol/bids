-- pp.customers  (2474 rows)
CREATE TABLE pp.customers (
  CUSTMR               char(7) NOT NULL,
  CUSNAM               varchar(30),
  ADDR1                varchar(30),
  ADDR2                varchar(30),
  ADDR3                varchar(30),
  TELPHN               varchar(20),
  FAX                  varchar(20),
  SUTERMS              varchar(6),
  POSTAL               varchar(10),
  SALOFF               char(2),
  ARBAL                numeric(9,2),
  SENINV               char(1),
  CUSTYP               char(1),
  PROVNC               char(2),
  COUNTR               varchar(20),
  EMLINVCON            varchar(12),
  PRIMARY KEY (CUSTMR)
);