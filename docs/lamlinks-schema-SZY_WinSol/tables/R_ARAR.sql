-- dbo.R_ARAR  (1710607 rows)
CREATE TABLE dbo.R_ARAR (
  CUSTMR               char(7) NOT NULL,
  INVOICE              char(7) NOT NULL,
  LASTRA               numeric(2,0),
  INVCDAT              datetime,
  INVCAMT              numeric(10,2),
  TOTPAY               numeric(10,2),
  TERMS                varchar(6),
  SALORD               varchar(6),
  SOLDTO               varchar(7),
  GSTAMT               numeric(10,2),
  BILLAD               varchar(7),
  DISALL               numeric(10,2),
  DISTAK               numeric(10,2),
  QUIPAYDAT            datetime,
  PRIMARY KEY (CUSTMR, INVOICE)
);