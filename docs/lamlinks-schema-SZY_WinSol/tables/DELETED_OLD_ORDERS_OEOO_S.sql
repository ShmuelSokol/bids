-- dbo.DELETED_OLD_ORDERS_OEOO_S  (5 rows)
CREATE TABLE dbo.DELETED_OLD_ORDERS_OEOO_S (
  p_id                 int NOT NULL,
  oeoo_1_p_id          int NOT NULL,
  SALORD               varchar(6),
  LINE                 varchar(3),
  SUPCHA               varchar(2),
  SUPCHADES            varchar(25),
  QTY                  numeric(6,2),
  RATE                 numeric(6,2),
  INVOICE              varchar(7),
  PERVAL               varchar(4),
  AMT                  numeric(8,2),
  PROTAX               varchar(8),
  TAXGRO               varchar(8),
  TAXOVE               varchar(1),
  LINEXT               numeric(10,0),
  REGIND               varchar(1),
  GSTRAT               varchar(1),
  GLACCT               varchar(8)
);