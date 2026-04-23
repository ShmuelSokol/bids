-- dbo.def_arar  (0 rows)
CREATE TABLE dbo.def_arar (
  CUSTMR               varchar(7) NOT NULL,
  INVOICE              varchar(7) NOT NULL,
  LASTRA               numeric(2,0) NOT NULL,
  INVCDAT              date NOT NULL,
  INVCAMT              numeric(10,2) NOT NULL,
  TOTPAY               numeric(10,2) NOT NULL,
  TERMS                varchar(6) NOT NULL,
  SALORD               varchar(6) NOT NULL,
  SOLDTO               varchar(7) NOT NULL,
  GSTAMT               numeric(10,2) NOT NULL,
  BILLAD               varchar(7) NOT NULL,
  DISALL               numeric(10,2) NOT NULL,
  DISTAK               numeric(10,2) NOT NULL,
  QUIPAYDAT            date NOT NULL
);